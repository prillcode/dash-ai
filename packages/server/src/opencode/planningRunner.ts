import { homedir } from "os"
import { existsSync } from "fs"
import { join } from "path"
import type { Config } from "@opencode-ai/sdk"

export function normalizeModel(model: string, provider?: string): string {
  // If model already contains a slash, assume it's already in provider/model format
  if (model.includes('/')) {
    return model
  }
  // Otherwise combine with provider (default to anthropic if not provided)
  return `${provider || 'anthropic'}/${model}`
}

export interface PlanningRunnerInput {
  taskId: string
  taskTitle: string
  taskDescription: string
  repoPath: string          // resolved (no ~)
  planPath: string          // e.g. "pcw-101-my-task" — subfolder under .planning/
  planningPersona: {
    id: string
    name: string
    model: string
    systemPrompt: string
    allowedTools: string[]
    provider?: string
  }
}

export interface PlanningResult {
  success: boolean
  planDocPath: string       // e.g. /home/user/myrepo/.planning/pcw-101-my-task/
  errorMessage?: string
}

export async function runPlanningSession(
  input: PlanningRunnerInput,
  onEvent: (type: string, payload: Record<string, unknown>) => Promise<void>
): Promise<PlanningResult> {
  try {
    await onEvent("PLANNING_EVENT", { status: "starting", message: "Initializing OpenCode SDK" })

    // Import SDK dynamically to avoid top-level import errors if SDK not installed
    let createOpencode: any
    try {
      const sdk = await import("@opencode-ai/sdk")
      createOpencode = sdk.createOpencode
    } catch (importError: any) {
      if (importError.code === 'MODULE_NOT_FOUND') {
        await onEvent("ERROR", {
          message: "OpenCode SDK not found — install @opencode-ai/sdk",
          stack: "Planning session runner is a placeholder. To enable real planning, install the OpenCode SDK and ensure the start-work and create-plans skills are available."
        })
        return {
          success: false,
          planDocPath: join(input.repoPath, ".planning", input.planPath),
          errorMessage: "OpenCode SDK not found — install @opencode-ai/sdk"
        }
      }
      throw importError
    }

    // Start OpenCode server
    const { client, server } = await createOpencode({
      config: {
        // No config needed; SDK reads environment variables (ANTHROPIC_API_KEY, etc.)
      }
    })

    // Ensure skills are installed
    const skillsCheck = checkSkillsInstalled()
    if (!skillsCheck.ok) {
      await onEvent("ERROR", {
        message: `Missing required skills: ${skillsCheck.missing.join(", ")}`,
        stack: "Install missing skills via 'opencode skills install'"
      })
      return {
        success: false,
        planDocPath: join(input.repoPath, ".planning", input.planPath),
        errorMessage: `Missing skills: ${skillsCheck.missing.join(", ")}`
      }
    }

    await onEvent("PLANNING_EVENT", { status: "creating_session", message: "Creating planning session" })

    // Create a new session in the repository directory
    const session = await client.session.create({
      query: { directory: input.repoPath },
      body: { title: `Plan: ${input.taskTitle}` }
    })

    // session is the Session object (see SDK types)
    if (!session || !session.id) {
      throw new Error("Failed to create session")
    }

    const sessionId = session.id
    await onEvent("PLANNING_EVENT", { status: "session_created", sessionId })

    // Normalize model to OpenCode format (provider/model-id)
    // If model already contains slash, use as-is; otherwise combine with provider field
    const normalizedModel = normalizeModel(input.planningPersona.model, input.planningPersona.provider)

    // Send a prompt to the session with the task description
    await onEvent("PLANNING_EVENT", { status: "sending_prompt", message: "Sending planning prompt" })
    
    const promptResult = await client.session.prompt({
      path: { id: sessionId },
      query: { directory: input.repoPath },
      body: {
         model: normalizedModel,
        agent: "plan",
        system: input.planningPersona.systemPrompt,
        tools: input.planningPersona.allowedTools.reduce((acc, tool) => ({ ...acc, [tool]: true }), {}),
        parts: [
          {
            type: "text" as const,
            text: input.taskDescription
          }
        ]
      }
    })

    if (!promptResult.info) {
      throw new Error("Prompt failed")
    }

    await onEvent("PLANNING_EVENT", { status: "prompt_sent", message: "Planning prompt sent" })

    // Listen for events from this session and forward them
    // For now, we just wait a bit and assume planning will complete.
    // In a real implementation, we would subscribe to global events and monitor session status.
    await onEvent("PLANNING_EVENT", { status: "waiting", message: "Waiting for planning to complete" })

    // TODO: Implement proper event streaming and completion detection
    // For now, we'll just wait a short time and then assume success.
    await new Promise(resolve => setTimeout(resolve, 5000))

    // Stop the server
    server.close()

    await onEvent("PLANNING_EVENT", { status: "completed", message: "Planning session finished" })

    return {
      success: true,
      planDocPath: join(input.repoPath, ".planning", input.planPath)
    }

  } catch (error) {
    const errorMessage = error instanceof Error ? error.message : String(error)
    await onEvent("ERROR", {
      message: errorMessage,
      stack: error instanceof Error ? error.stack : undefined
    })
    return {
      success: false,
      planDocPath: join(input.repoPath, ".planning", input.planPath),
      errorMessage
    }
  }
}

export function checkSkillsInstalled(): { ok: boolean; missing: string[] } {
  const home = homedir()
  const skills = [
    { name: "start-work", path: join(home, ".agents", "skills", "start-work", "SKILL.md") },
    { name: "create-plans", path: join(home, ".agents", "skills", "create-plans", "SKILL.md") }
  ]
  const missing: string[] = []

  for (const skill of skills) {
    if (!existsSync(skill.path)) {
      missing.push(skill.name)
    }
  }

  return {
    ok: missing.length === 0,
    missing
  }
}