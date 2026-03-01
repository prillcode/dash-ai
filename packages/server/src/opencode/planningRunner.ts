import { homedir } from "os"
import { join } from "path"
import { existsSync } from "fs"
import { createOpencode } from "@opencode-ai/sdk"

export function checkSkillsInstalled(): { ok: boolean; missing: string[] } {
  const required = ["start-work", "create-plans"]
  const missing = required.filter(
    (skill) => !existsSync(join(homedir(), ".agents", "skills", skill))
  )
  return { ok: missing.length === 0, missing }
}

export function normalizeModel(model: string, provider?: string): { providerID: string; modelID: string } {
  if (model.includes("/")) {
    const slash = model.indexOf("/")
    return { providerID: model.slice(0, slash), modelID: model.slice(slash + 1) }
  }
  return { providerID: provider || "anthropic", modelID: model }
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
    await onEvent("PLANNING_EVENT", { status: "creating_session", message: "Creating planning session" })

    const { client } = await createOpencode({ config: {} })

    const createResult = await client.session.create({
      query: { directory: input.repoPath },
      body: { title: `Plan: ${input.taskTitle}` },
    })

    if (createResult.error || !createResult.data?.id) {
      throw new Error(`Failed to create planning session: ${JSON.stringify(createResult.error)}`)
    }

    const sessionId = createResult.data.id
    await onEvent("PLANNING_EVENT", { status: "session_created", sessionId })

    const model = normalizeModel(input.planningPersona.model, input.planningPersona.provider)

    await onEvent("PLANNING_EVENT", { status: "sending_prompt", message: "Sending planning prompt" })

    const promptResult = await client.session.prompt({
      path: { id: sessionId },
      query: { directory: input.repoPath },
      body: {
        model,
        agent: "plan",
        system: input.planningPersona.systemPrompt,
        parts: [
          {
            type: "text" as const,
            text: input.taskDescription,
          },
        ],
      },
    })

    if (promptResult.error) {
      throw new Error(`Prompt submission failed: ${JSON.stringify(promptResult.error)}`)
    }

    await onEvent("PLANNING_EVENT", { status: "prompt_sent", message: "Planning prompt sent, waiting for completion" })

    // Subscribe to the global event stream and filter for this session.
    // The SSE result exposes a .stream AsyncGenerator — iterate that, not the result itself.
    // Completion:  EventSessionIdle   { type: "session.idle",   properties: { sessionID } }
    //              EventSessionStatus { type: "session.status", properties: { sessionID, status: { type: "idle" } } }
    // Error:       EventSessionError  { type: "session.error",  properties: { sessionID, error } }
    let completed = false
    let sessionError: string | undefined

    try {
      const eventResult = await client.event.subscribe({
        query: { directory: input.repoPath },
      })

      for await (const raw of eventResult.stream) {
        const evt = raw as { type: string; properties?: Record<string, any> }
        const props = evt.properties || {}

        // Filter to our session only
        if (props.sessionID && props.sessionID !== sessionId) continue

        await onEvent("PLANNING_EVENT", { status: evt.type, ...props })

        if (evt.type === "session.idle") {
          completed = true
          break
        }

        if (evt.type === "session.status" && props.status?.type === "idle") {
          completed = true
          break
        }

        if (evt.type === "session.error") {
          const err = props.error
          sessionError = err?.data?.message || err?.name || JSON.stringify(err) || "Unknown session error"
          break
        }
      }
    } catch (streamError) {
      const msg = streamError instanceof Error ? streamError.message : String(streamError)
      if (msg.includes("timeout") || msg.includes("aborted")) {
        throw new Error("Planning session timed out waiting for completion")
      }
      throw streamError
    }

    if (sessionError) {
      throw new Error(`Planning session error: ${sessionError}`)
    }

    if (!completed) {
      throw new Error("Planning session ended without completion signal")
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
      stack: error instanceof Error ? error.stack : undefined,
    })

    return {
      success: false,
      planDocPath: join(input.repoPath, ".planning", input.planPath || ""),
      errorMessage,
    }
  }
}
