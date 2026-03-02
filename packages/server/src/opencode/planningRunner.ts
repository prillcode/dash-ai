import { homedir } from "os"
import { join } from "path"
import { existsSync } from "fs"
import { createOpencode } from "@opencode-ai/sdk"
import { checkProviderAuth, loadProviderConfig } from "./authCheck"

/**
 * Poll GET /config/providers until the required providerID appears in the list.
 * The spawned `opencode serve` process initialises providers asynchronously; sending
 * a prompt before they are ready causes the model call to be silently dropped.
 *
 * Polls every 200ms, times out after 10s.
 */
// eslint-disable-next-line @typescript-eslint/no-explicit-any
async function waitForProvider(
  client: any,
  providerID: string,
  directory: string,
  timeoutMs = 10_000
): Promise<void> {
  const deadline = Date.now() + timeoutMs
  while (Date.now() < deadline) {
    const result = await client.config.providers({ query: { directory } })
    const providers: Array<{ id?: string }> = (result.data as any)?.providers ?? []
    if (providers.some((p) => p.id === providerID)) return
    await new Promise((r) => setTimeout(r, 200))
  }
  throw new Error(`Provider "${providerID}" not ready after ${timeoutMs}ms`)
}

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
  taskIdentifier?: string   // e.g. "CD-101" — passed to /start-work as the work identifier
  targetFiles?: string[]    // relevant files, passed as context to /start-work
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

function buildPlanningPrompt(input: PlanningRunnerInput): string {
  const identifier = input.taskIdentifier ?? ""
  // Derive a kebab-case work name from the task title for /start-work
  const workName = input.taskTitle
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-|-$/g, "")
    .slice(0, 40)

  const filesSection = input.targetFiles?.length
    ? `\n## Relevant files\n${input.targetFiles.map((f) => `- ${f}`).join("\n")}`
    : ""

  return [
    `You are a planning agent. Your only job is to scaffold and write planning documents.`,
    `Do NOT write, create, or modify any source code files. Do NOT implement the feature.`,
    ``,
    `## Instructions`,
    ``,
    `1. Load the /start-work skill and run it with the following pre-supplied answers`,
    `   (do not ask the user any questions — all information is provided below):`,
    `   - Identifier: ${identifier || "(auto-generate)"}`,
    `   - Work name: ${workName}`,
    `   - Description: ${input.taskDescription}`,
    `   - Work type: Feature`,
    `   - Relevant files: ${input.targetFiles?.join(", ") || "(scan automatically)"}`,
    ``,
    `2. Once the .planning/ directory is scaffolded, load the /create-plans skill`,
    `   and produce the plan files for the task described below.`,
    ``,
    `3. When all plan files are written, stop. Do not implement anything.`,
    ``,
    `## Task`,
    `Title: ${input.taskTitle}`,
    `Description: ${input.taskDescription}`,
    filesSection,
  ].join("\n")
}

export async function runPlanningSession(
  input: PlanningRunnerInput,
  onEvent: (type: string, payload: Record<string, unknown>) => Promise<void>
): Promise<PlanningResult> {
  try {
    await onEvent("PLANNING_EVENT", { status: "starting", message: "Initializing OpenCode SDK" })

    // Pre-flight: verify provider credentials before spawning an OpenCode server.
    // Without this, an expired/missing token causes a silent hang with no error event.
    const authCheck = await checkProviderAuth(input.planningPersona.provider || input.planningPersona.model)
    if (!authCheck.ok) {
      throw new Error(authCheck.errorMessage!)
    }

    await onEvent("PLANNING_EVENT", { status: "creating_session", message: "Creating planning session" })

    // Inject API keys from auth.json / env vars into the spawned OpenCode server
    // via OPENCODE_CONFIG_CONTENT so it can authenticate without reading auth.json itself.
    const providerConfig = await loadProviderConfig()
    const { client } = await createOpencode({ config: { provider: providerConfig } })

    const createResult = await client.session.create({
      query: { directory: input.repoPath },
      body: { title: `Plan: ${input.taskTitle}` },
    })

    if (createResult.error || !createResult.data?.id) {
      throw new Error(`Failed to create planning session: ${JSON.stringify(createResult.error)}`)
    }

    const sessionId = createResult.data.id
    await onEvent("PLANNING_EVENT", { status: "session_created", sessionId })

    // Wait for the required provider to finish initialising before sending the prompt.
    // The spawned opencode serve process initialises providers asynchronously; if we
    // send the prompt while the provider is still loading, the model call is silently
    // dropped and the session hangs indefinitely with only heartbeat events.
    const { providerID } = normalizeModel(input.planningPersona.model, input.planningPersona.provider)
    await waitForProvider(client, providerID, input.repoPath)
    await onEvent("PLANNING_EVENT", { status: "provider_ready", message: `Provider ${providerID} ready` })

    // Subscribe to the event stream BEFORE sending the prompt to avoid a race
    // condition where the session completes before we start listening.
    // EventSessionIdle   { type: "session.idle",   properties: { sessionID } }
    // EventSessionStatus { type: "session.status", properties: { sessionID, status: { type: "idle" } } }
    // EventSessionError  { type: "session.error",  properties: { sessionID?, error } }
    const eventResult = await client.event.subscribe({
      query: { directory: input.repoPath },
    })

    const model = normalizeModel(input.planningPersona.model, input.planningPersona.provider)

    await onEvent("PLANNING_EVENT", { status: "sending_prompt", message: "Sending planning prompt" })

    const promptResult = await client.session.prompt({
      path: { id: sessionId },
      query: { directory: input.repoPath },
      body: {
        model,
        // Use "build" agent, not "plan" — OpenCode's "plan" agent is its own interactive
        // planning mode that restricts writes to .opencode/plans/*.md only, which is not
        // what we want. Behavior is controlled entirely by Probi's system prompt instead.
        agent: "build",
        // noReply: true SUPPRESSES model execution entirely — do not set it.
        system: input.planningPersona.systemPrompt,
        parts: [
          {
            type: "text" as const,
            text: buildPlanningPrompt(input),
          },
        ],
      },
    })

    if (promptResult.error) {
      throw new Error(`Prompt submission failed: ${JSON.stringify(promptResult.error)}`)
    }

    await onEvent("PLANNING_EVENT", { status: "prompt_sent", message: "Planning prompt sent, waiting for completion" })

    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const anyClient = client as any
    let completed = false
    let sessionError: string | undefined

    // Wall-clock timeout: 15 minutes for a planning session
    const SESSION_TIMEOUT_MS = 15 * 60 * 1000
    const deadline = Date.now() + SESSION_TIMEOUT_MS

    /**
     * Poll session messages every 5s as a belt-and-suspenders fallback.
     * The SSE stream is a long-lived connection that never closes on its own,
     * so session.idle can be missed if emitted before we start consuming.
     * When we detect completion via poll, we signal via the abort controller
     * to break out of the stream loop.
     */
    const abortController = new AbortController()

    const pollForCompletion = async (): Promise<"completed" | "error" | "timeout"> => {
      while (!abortController.signal.aborted) {
        if (Date.now() > deadline) return "timeout"
        await new Promise((r) => setTimeout(r, 5_000))
        if (abortController.signal.aborted) break
        try {
          const msgsResult = await anyClient.session.messages({
            path: { id: sessionId },
            query: { directory: input.repoPath },
          })
          const msgs: any[] = msgsResult.data ?? []
          const lastAssistant = msgs.filter((m: any) => m.info?.role === "assistant").at(-1)
          if (lastAssistant?.info?.finish === "stop") return "completed"
          // Check for error finish
          if (lastAssistant?.info?.finish === "error") {
            sessionError = lastAssistant?.info?.error?.message ?? "Session finished with error"
            return "error"
          }
          // Also check pending questions and auto-answer them
          const qList = await anyClient.question.list({ query: { directory: input.repoPath } })
          const pending: any[] = qList.data ?? []
          for (const q of pending) {
            if (q.sessionID !== sessionId) continue
            if (!q.questions?.length) continue
            const answers = q.questions.map((question: any) => [question.options?.[0]?.label ?? "yes"])
            await anyClient.question.reply({
              path: { requestID: q.id },
              query: { directory: input.repoPath },
              body: { answers },
            })
            await onEvent("PLANNING_EVENT", { status: "question.answered", questionId: q.id, answers })
          }
        } catch {
          // Transient poll error — keep trying
        }
      }
      return "completed"
    }

    // Run event stream and poll concurrently; whichever signals completion wins.
    const streamLoop = async (): Promise<void> => {
      try {
        for await (const raw of eventResult.stream) {
          if (abortController.signal.aborted) break
          const evt = raw as { type: string; properties?: Record<string, any> }
          const props = evt.properties || {}

          // Filter to our session only (heartbeats etc have no sessionID — let them through for UI)
          if (props.sessionID && props.sessionID !== sessionId) continue

          // For message.part.updated events, extract human-readable content from the part
          // so the UI can show actual agent text/tool activity rather than raw event names.
          if (evt.type === "message.part.updated") {
            const part = props.part as any
            if (part?.type === "text" && part.text) {
              // Emit the latest full text of the message part (not just the delta)
              await onEvent("PLANNING_EVENT", {
                status: "agent.text",
                text: part.text,
                partId: part.id,
                messageId: part.messageID,
              })
            } else if (part?.type === "reasoning" && part.text) {
              await onEvent("PLANNING_EVENT", {
                status: "agent.reasoning",
                text: part.text,
                partId: part.id,
              })
            } else if (part?.type === "tool") {
              const state = part.state as any
              const toolName = part.tool as string
              const isComplete = state?.status === "completed" || state?.status === "error"
              await onEvent("PLANNING_EVENT", {
                status: isComplete ? "tool.complete" : "tool.running",
                tool: toolName,
                toolState: state?.status,
                partId: part.id,
              })
            } else {
              // Other part types — emit raw
              await onEvent("PLANNING_EVENT", { status: evt.type, ...props })
            }
            continue
          }

          // For message.part.delta events, skip — message.part.updated covers the full text
          if (evt.type === "message.part.delta") continue

          await onEvent("PLANNING_EVENT", { status: evt.type, ...props })

          // Auto-answer questions inline from the stream as well
          if (evt.type === "question.asked") {
            try {
              const questionId = props.id as string | undefined
              if (questionId) {
                const questionList = await anyClient.question.list({ query: { directory: input.repoPath } })
                const pendingQs: any[] = questionList.data ?? []
                const q = pendingQs.find((p: any) => p.id === questionId)
                if (q?.questions?.length) {
                  const answers = q.questions.map((question: any) => [question.options?.[0]?.label ?? "yes"])
                  await anyClient.question.reply({
                    path: { requestID: questionId },
                    query: { directory: input.repoPath },
                    body: { answers },
                  })
                  await onEvent("PLANNING_EVENT", { status: "question.answered", questionId, answers })
                }
              }
            } catch (qErr) {
              await onEvent("PLANNING_EVENT", { status: "question.answer_failed", error: String(qErr) })
            }
          }

          if (evt.type === "session.idle" && props.sessionID === sessionId) {
            abortController.abort()
            completed = true
            return
          }
          if (evt.type === "session.status" && props.sessionID === sessionId && props.status?.type === "idle") {
            abortController.abort()
            completed = true
            return
          }
          if (evt.type === "session.error" && (!props.sessionID || props.sessionID === sessionId)) {
            const err = props.error
            sessionError = err?.data?.message || err?.name || JSON.stringify(err) || "Unknown session error"
            abortController.abort()
            return
          }
        }
      } catch (streamError) {
        if (abortController.signal.aborted) return // expected — poll won the race
        const msg = streamError instanceof Error ? streamError.message : String(streamError)
        if (!msg.includes("aborted")) throw streamError
      }
    }

    // Race: whichever resolves first (poll detecting finish, or stream idle event) wins.
    // We do NOT await streamLoop here — it blocks forever on the open SSE connection.
    // Instead, poll drives completion; streamLoop runs fire-and-forget for live events.
    streamLoop() // fire and forget — events flow to UI but don't block completion
    const pollResult = await pollForCompletion()
    abortController.abort() // signal stream loop to stop on next iteration

    if (!completed) {
      if (pollResult === "timeout") {
        throw new Error(`Planning session timed out after ${SESSION_TIMEOUT_MS / 60000} minutes`)
      }
      if (pollResult === "error" || sessionError) {
        throw new Error(`Planning session error: ${sessionError ?? "unknown"}`)
      }
      // Poll detected completion via message finish
      await onEvent("PLANNING_EVENT", { status: "session.idle", sessionID: sessionId, source: "poll" })
      completed = true
    }

    if (sessionError) {
      throw new Error(`Planning session error: ${sessionError}`)
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
