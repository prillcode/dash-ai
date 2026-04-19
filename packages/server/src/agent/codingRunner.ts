import { homedir } from "os"
import { join } from "path"
import { mkdir, appendFile } from "fs/promises"
import { exec } from "child_process"
import { promisify } from "util"
import {
  createAgentSession,
  SessionManager,
  createCodingTools,
  DefaultResourceLoader,
  SettingsManager,
} from "@mariozechner/pi-coding-agent"
import { resolveModel, checkProviderAuth } from "./piSession"

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

async function logEvent(
  logPath: string,
  type: string,
  data: Record<string, unknown>
): Promise<void> {
  const timestamp = new Date().toISOString()
  const logLine = `[${timestamp}] [${type}] ${JSON.stringify(data)}\n`
  await appendFile(logPath, logLine)
}

/**
 * Capture git diff HEAD as the session artifact.
 * Returns true if a non-empty diff was captured.
 */
async function captureGitDiff(repoPath: string, diffPath: string): Promise<boolean> {
  try {
    const { stdout } = await execAsync("git diff HEAD", { cwd: repoPath })
    if (stdout) {
      await appendFile(diffPath, stdout)
      return true
    }
  } catch {
    // git diff failed (e.g. not a git repo, no HEAD)
  }
  return false
}

const SESSION_TIMEOUT_MS = 20 * 60 * 1000 // 20 minutes

/**
 * Run a coding session using Pi SDK with in-process agent sessions.
 * Invokes /skill:start-work-run for structured, phased code execution
 * with full tool access (read, bash, edit, write).
 */
export async function runCodingSession(
  input: CodingRunnerInput,
  onEvent: (type: string, payload: Record<string, unknown>) => Promise<void>
): Promise<CodingResult> {
  const home = homedir()
  const sessionDir = join(home, ".dash-ai", "sessions", input.taskId)
  const diffDir = join(home, ".dash-ai", "diffs", input.taskId)
  const logPath = join(sessionDir, "session.log")
  const diffPath = join(diffDir, "changes.diff")

  try {
    await mkdir(sessionDir, { recursive: true })
    await mkdir(diffDir, { recursive: true })

    await onEvent("CODING_EVENT", { status: "starting", message: "Starting coding session" })
    await logEvent(logPath, "CODING_EVENT", { status: "starting" })

    // Auth pre-flight
    const providerID = input.codingPersona.provider || "anthropic"
    const authCheck = await checkProviderAuth(providerID)
    if (!authCheck.ok) throw new Error(authCheck.errorMessage!)

    // Resolve model
    const model = await resolveModel(providerID, input.codingPersona.model)

    await onEvent("CODING_EVENT", {
      status: "launching",
      model: `${model.provider}/${model.id}`,
    })
    await logEvent(logPath, "CODING_EVENT", { status: "launching", model: `${model.provider}/${model.id}` })

    // Build resource loader — persona system prompt, Pi discovers skills automatically
    const loader = new DefaultResourceLoader({
      cwd: input.repoPath,
      systemPrompt: input.codingPersona.systemPrompt,
    })
    await loader.reload()

    const { session } = await createAgentSession({
      cwd: input.repoPath,
      model,
      thinkingLevel: "medium",
      tools: createCodingTools(input.repoPath),
      resourceLoader: loader,
      sessionManager: SessionManager.inMemory(),
      settingsManager: SettingsManager.inMemory({ compaction: { enabled: true } }),
    })

    // Subscribe and forward events
    session.subscribe((event) => {
      switch (event.type) {
        case "message_update":
          if ((event as any).assistantMessageEvent?.type === "text_delta") {
            onEvent("CODING_TEXT", { delta: (event as any).assistantMessageEvent.delta })
          }
          break
        case "tool_execution_start":
          onEvent("TOOL_START", { toolName: (event as any).toolName, args: (event as any).args })
          break
        case "tool_execution_end":
          onEvent("TOOL_END", { toolName: (event as any).toolName, isError: (event as any).isError })
          break
        case "turn_start":
          onEvent("TURN_START", { turnIndex: (event as any).turnIndex })
          break
        case "turn_end":
          onEvent("TURN_END", { turnIndex: (event as any).turnIndex })
          break
        case "agent_end":
          onEvent("CODING_EVENT", { status: "completed" })
          break
      }
    })

    // Timeout wrapper
    const timeoutId = setTimeout(() => {
      session.abort()
    }, SESSION_TIMEOUT_MS)

    try {
      // Invoke start-work-run to execute all phase plans
      // The skill walks through phases sequentially with verification
      await session.prompt(
        [
          `/skill:start-work-run`,
          `Plan path: ${input.planPath}`,
          `Task: ${input.taskTitle}`,
          ``,
          input.taskDescription,
        ].join("\n")
      )
    } finally {
      clearTimeout(timeoutId)
    }

    await onEvent("CODING_EVENT", { status: "session_finished", message: "Coding session finished, capturing diff" })
    await logEvent(logPath, "CODING_EVENT", { status: "session_finished" })

    // Capture git diff after session completes
    const diffCaptured = await captureGitDiff(input.repoPath, diffPath)
    if (diffCaptured) {
      await logEvent(logPath, "CODING_EVENT", { status: "diff_captured", source: "git" })
    } else {
      await logEvent(logPath, "CODING_EVENT", { status: "diff_empty", message: "No changes detected" })
    }

    session.dispose()

    await onEvent("CODING_EVENT", { status: "completed", message: "Coding session complete" })
    await logEvent(logPath, "CODING_EVENT", { status: "completed" })

    return {
      success: true,
      sessionId: session.sessionId,
      diffPath: diffCaptured ? diffPath : undefined,
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
  }
}
