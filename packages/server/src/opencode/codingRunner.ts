import { homedir } from "os"
import { join } from "path"
import { mkdir, appendFile } from "fs/promises"
import { exec } from "child_process"
import { promisify } from "util"
import { createOpencode } from "@opencode-ai/sdk"
import { normalizeModel } from "./planningRunner"
import { checkProviderAuth, loadProviderConfig } from "./authCheck"

/**
 * Poll GET /config/providers until the required providerID appears.
 * Mirrors the same helper in planningRunner — providers initialise asynchronously
 * and a prompt sent too early will be silently dropped.
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

const execAsync = promisify(exec)

export interface CodingRunnerInput {
  taskId: string
  taskTitle: string
  taskDescription: string
  repoPath: string
  planPath: string
  codingPersona: {
    id: string
    name: string
    model: string
    systemPrompt: string
    allowedTools: string[]
    provider?: string
  }
}

export interface CodingResult {
  success: boolean
  sessionId: string
  diffPath?: string
  logPath?: string
  errorMessage?: string
}

function detectAuthError(errorText: string): boolean {
  const patterns = [
    /authentication/i,
    /401/i,
    /403/i,
    /invalid_api_key/i,
    /ANTHROPIC_API_KEY/i,
    /DEEPSEEK_API_KEY/i,
    /OPENAI_API_KEY/i,
    /API_KEY/i,
    /unauthorized/i,
    /permission denied/i,
    /ProviderAuthError/i,
  ]
  return patterns.some((pattern) => pattern.test(errorText))
}

async function logEvent(
  logPath: string,
  type: string,
  data: Record<string, unknown>
): Promise<void> {
  const timestamp = new Date().toISOString()
  const logLine = `[${timestamp}] [${type}] ${JSON.stringify(data)}\n`
  await appendFile(logPath, logLine)
}

export async function runCodingSession(
  input: CodingRunnerInput,
  onEvent: (type: string, payload: Record<string, unknown>) => Promise<void>
): Promise<CodingResult> {
  const home = homedir()
  const sessionDir = join(home, ".dash-ai", "sessions", input.taskId)
  const diffDir = join(home, ".dash-ai", "diffs", input.taskId)
  const logPath = join(sessionDir, "session.log")
  const diffPath = join(diffDir, "changes.diff")

  // Hoisted so the finally block can always kill the spawned opencode serve process.
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  let server: any = null
  try {
    await mkdir(sessionDir, { recursive: true })
    await mkdir(diffDir, { recursive: true })

    // Pre-flight: verify provider credentials before spawning an OpenCode server.
    // Without this, an expired/missing token causes a silent hang with no error event.
    const authCheck = await checkProviderAuth(input.codingPersona.provider || input.codingPersona.model)
    if (!authCheck.ok) {
      throw new Error(authCheck.errorMessage!)
    }

    // Inject API keys from auth.json / env vars into the spawned OpenCode server
    // via OPENCODE_CONFIG_CONTENT so it can authenticate without reading auth.json itself.
    const providerConfig = await loadProviderConfig()
    const opencodeInstance = await createOpencode({ config: { provider: providerConfig } })
    server = opencodeInstance.server
    const client = opencodeInstance.client

    await logEvent(logPath, "CODING_EVENT", { status: "creating_session" })
    await onEvent("CODING_EVENT", { status: "creating_session", message: "Creating coding session" })

    const createResult = await client.session.create({
      query: { directory: input.repoPath },
      body: { title: `Code: ${input.taskTitle}` },
    })

    if (createResult.error || !createResult.data?.id) {
      throw new Error(`Failed to create session: ${JSON.stringify(createResult.error)}`)
    }

    const sessionId = createResult.data.id
    await logEvent(logPath, "CODING_EVENT", { status: "session_created", sessionId })
    await onEvent("CODING_EVENT", { status: "session_created", sessionId })

    // model must be { providerID, modelID } — normalizeModel returns this shape
    const model = normalizeModel(input.codingPersona.model, input.codingPersona.provider)

    // Wait for the provider to finish initialising before sending the prompt.
    await waitForProvider(client, model.providerID, input.repoPath)
    await logEvent(logPath, "CODING_EVENT", { status: "provider_ready", providerID: model.providerID })
    await onEvent("CODING_EVENT", { status: "provider_ready", message: `Provider ${model.providerID} ready` })

    await logEvent(logPath, "CODING_EVENT", { status: "sending_prompt" })
    await onEvent("CODING_EVENT", { status: "sending_prompt", message: "Sending coding prompt" })

    const promptResult = await client.session.prompt({
      path: { id: sessionId },
      query: { directory: input.repoPath },
      body: {
        model,
        agent: "build",
        // noReply: true SUPPRESSES model execution entirely — do not set it.
        system: input.codingPersona.systemPrompt,
        tools: input.codingPersona.allowedTools.reduce(
          (acc: Record<string, boolean>, tool: string) => ({ ...acc, [tool]: true }),
          {}
        ),
        parts: [
          {
            type: "text" as const,
            text: `IMPORTANT: Do not ask for confirmation or clarification. Proceed immediately and completely.\n\n${input.taskDescription}`,
          },
        ],
      },
    })

    if (promptResult.error) {
      throw new Error(`Prompt failed: ${JSON.stringify(promptResult.error)}`)
    }

    await logEvent(logPath, "CODING_EVENT", { status: "prompt_sent" })
    await onEvent("CODING_EVENT", { status: "prompt_sent", message: "Coding prompt sent, waiting for completion" })

    // Subscribe to global event stream and filter for our session.
    // Completion: EventSessionIdle { type: "session.idle", properties: { sessionID } }
    //             EventSessionStatus { type: "session.status", properties: { sessionID, status: { type: "idle" } } }
    // Error:      EventSessionError  { type: "session.error", properties: { sessionID, error } }
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

        // For message.part.updated events, extract human-readable content from the part
        if (evt.type === "message.part.updated") {
          const part = props.part as any
          if (part?.type === "text" && part.text) {
            await onEvent("CODING_EVENT", { status: "agent.text", text: part.text, partId: part.id })
          } else if (part?.type === "reasoning" && part.text) {
            await onEvent("CODING_EVENT", { status: "agent.reasoning", text: part.text, partId: part.id })
          } else if (part?.type === "tool") {
            const state = part.state as any
            const isComplete = state?.status === "completed" || state?.status === "error"
            await onEvent("CODING_EVENT", {
              status: isComplete ? "tool.complete" : "tool.running",
              tool: part.tool,
              toolState: state?.status,
              partId: part.id,
            })
          }
          continue
        }
        // Skip deltas — part.updated carries the full text
        if (evt.type === "message.part.delta") continue

        await logEvent(logPath, "CODING_EVENT", { eventType: evt.type, ...props })
        await onEvent("CODING_EVENT", { status: evt.type, ...props })

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
          sessionError =
            err?.data?.message || err?.name || JSON.stringify(err) || "Unknown session error"
          // Check for auth errors specifically
          if (
            err?.name === "ProviderAuthError" ||
            detectAuthError(sessionError ?? "")
          ) {
            sessionError =
              "Authentication failed. Use the OpenCode TUI to connect a provider, or set ANTHROPIC_API_KEY / DEEPSEEK_API_KEY in your environment."
          }
          break
        }
      }
    } catch (streamError) {
      const msg = streamError instanceof Error ? streamError.message : String(streamError)
      if (msg.includes("timeout") || msg.includes("aborted")) {
        throw new Error("Coding session timed out waiting for completion")
      }
      throw streamError
    }

    if (sessionError) {
      throw new Error(sessionError)
    }

    if (!completed) {
      throw new Error("Coding session ended without completion signal")
    }

    await logEvent(logPath, "CODING_EVENT", { status: "session_finished" })
    await onEvent("CODING_EVENT", { status: "session_finished", message: "Coding session finished, capturing diff" })

    // Capture diff — SDK returns Array<FileDiff> directly in .data
    const diffResult = await client.session.diff({
      path: { id: sessionId },
      query: { directory: input.repoPath },
    })

    const fileDiffs: Array<{ file: string; before: string; after: string }> =
      diffResult.data || []

    if (fileDiffs.length > 0) {
      const diffText = fileDiffs
        .map(
          (fd) =>
            `--- a/${fd.file}\n+++ b/${fd.file}\n${fd.before}\n${fd.after}`
        )
        .join("\n")
      await appendFile(diffPath, diffText)
      await logEvent(logPath, "CODING_EVENT", { status: "diff_captured", files: fileDiffs.length })
    } else {
      // Fallback: git diff HEAD
      try {
        const { stdout } = await execAsync("git diff HEAD", { cwd: input.repoPath })
        if (stdout) {
          await appendFile(diffPath, stdout)
          await logEvent(logPath, "CODING_EVENT", { status: "diff_captured", source: "git" })
        }
      } catch {
        await logEvent(logPath, "CODING_EVENT", { status: "diff_skipped", message: "No diff captured" })
      }
    }

    await logEvent(logPath, "CODING_EVENT", { status: "completed" })
    await onEvent("CODING_EVENT", { status: "completed", message: "Coding session complete" })

    return {
      success: true,
      sessionId,
      diffPath,
      logPath,
    }
  } catch (error) {
    const errorMessage = error instanceof Error ? error.message : String(error)

    try {
      await logEvent(logPath, "ERROR", {
        message: errorMessage,
        stack: error instanceof Error ? error.stack : undefined,
      })
    } catch {
      // logPath dir may not exist if mkdir failed
    }

    await onEvent("ERROR", {
      message: errorMessage,
      stack: error instanceof Error ? error.stack : undefined,
    })

    return {
      success: false,
      sessionId: "",
      errorMessage,
    }
  } finally {
    // Always kill the spawned `opencode serve` process when the session ends.
    // Without this, the process lingers and holds port 4096, causing
    // "Failed to start server on port 4096" errors on the next run.
    try { server?.close() } catch { /* ignore */ }
  }
}
