import { homedir } from "os"
import { join } from "path"
import { existsSync } from "fs"
import type { Config, createOpencode } from "@opencode-ai/sdk"

export function checkSkillsInstalled(): { ok: boolean; missing: string[] } {
  const required = ["start-work", "create-plans"]
  const missing = required.filter(
    (skill) => !existsSync(join(homedir(), ".agents", "skills", skill))
  )
  return { ok: missing.length === 0, missing }
}

export function normalizeModel(model: string, provider?: string): string {
  if (model.includes('/')) {
    return model
  }
  return `${provider || 'anthropic'}/${model}`
}

export interface PlanningRunnerInput {
  taskId: string
  taskTitle: string
  taskDescription: string
  repoPath: string
  planPath?: string
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
  planDocPath: string
  errorMessage?: string
}

export async function runPlanningSession(
  input: PlanningRunnerInput,
  onEvent: (type: string, payload: Record<string, unknown>) => Promise<void>
): Promise<PlanningResult> {
  try {
    await onEvent("PLANNING_EVENT", { status: "starting", message: "Initializing OpenCode SDK" })

    let createOpencodeServer: any
    try {
      const sdk = await import("@opencode-ai/sdk")
      createOpencodeServer = sdk.createOpencode
    } catch (importError: any) {
      if (importError.code === 'MODULE_NOT_FOUND') {
        await onEvent("ERROR", {
          message: "OpenCode SDK not found — install @opencode-ai/sdk",
          stack: "Planning session runner is a placeholder. To enable real planning, install OpenCode SDK and ensure start-work and create-plans skills are available."
        })
        return {
          success: false,
          planDocPath: join(input.repoPath, ".planning", input.planPath || ""),
          errorMessage: "OpenCode SDK not found — install @opencode-ai/sdk"
        }
      }
      throw importError
    }

    await onEvent("PLANNING_EVENT", { status: "creating_session", message: "Creating planning session" })

    const { client } = await createOpencodeServer({
      config: {}
    })

    const session = await client.session.create({
      query: { directory: input.repoPath },
      body: { title: `Plan: ${input.taskTitle}` }
    })

    if (!session || !session.id) {
      throw new Error("Failed to create session")
    }

    const sessionId = session.id
    await onEvent("PLANNING_EVENT", { status: "session_created", sessionId })

    const normalizedModel = normalizeModel(input.planningPersona.model, input.planningPersona.provider)

    await onEvent("PLANNING_EVENT", { status: "sending_prompt", message: "Sending planning prompt" })

    const promptResult = await client.session.prompt({
      path: { id: sessionId },
      query: { directory: input.repoPath },
      body: {
         model: normalizedModel,
         agent: "plan",
         system: input.planningPersona.systemPrompt,
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

    let completed = false
    let attempts = 0
    const maxAttempts = 300
    const pollInterval = 1000

    try {
      for await (const event of client.session.events({
        path: { id: sessionId },
        signal: AbortSignal.timeout(300000)
      })) {
        const eventType = event.event

        if (eventType === "session_completed" || eventType === "session_stopped") {
          completed = true
          await onEvent("PLANNING_EVENT", { status: "session_finished", eventType, timestamp: event.timestamp })
          await onEvent("PLANNING_EVENT", { status: "session_finished", message: "Planning session finished" })
          break
        } else if (eventType === "error") {
          const errorMsg = typeof event.data === 'string' ? event.data : JSON.stringify(event.data)
          await onEvent("PLANNING_EVENT", { status: "error", error: errorMsg })
          throw new Error(`Planning session error: ${errorMsg}`)
        } else {
          await onEvent("PLANNING_EVENT", {
            status: eventType,
            ...event.data,
            timestamp: event.timestamp
          })
        }

        attempts++
        if (!completed && attempts < maxAttempts) {
          await new Promise(resolve => setTimeout(resolve, pollInterval))
        }
      }

      if (!completed) {
        throw new Error("Session did not complete within timeout period")
      }
    } catch (error) {
      const errorMessage = error instanceof Error ? error.message : String(error)
      await onEvent("ERROR", {
        message: errorMessage,
        stack: error instanceof Error ? error.stack : undefined
      })
    }

    await onEvent("PLANNING_EVENT", { status: "completed", message: "Planning session finished" })

    return {
      success: true,
      planDocPath: join(input.repoPath, ".planning", input.planPath || ""),
    }
  } catch (error) {
    const errorMessage = error instanceof Error ? error.message : String(error)
    await onEvent("ERROR", {
      message: errorMessage,
      stack: error instanceof Error ? error.stack : undefined
    })

    return {
      success: false,
      planDocPath: join(input.repoPath, ".planning", input.planPath || ""),
      errorMessage
    }
  }
}
