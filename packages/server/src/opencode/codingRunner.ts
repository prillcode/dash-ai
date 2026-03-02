import { homedir, tmpdir } from "os"
import { join } from "path"
import { mkdir, appendFile } from "fs/promises"
import { writeFileSync, mkdirSync } from "fs"
import { exec, spawn } from "child_process"
import { promisify } from "util"
import { normalizeModel } from "./planningRunner"
import { checkProviderAuth } from "./authCheck"

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
 * Run a coding session by launching the opencode TUI in the user's terminal.
 * The user monitors progress directly in opencode. Dash AI waits for the process
 * to exit and then captures a git diff as the session artifact.
 *
 * Flow:
 *   1. Pre-flight auth check
 *   2. Spawn `opencode run <prompt>` in the repo directory (TUI renders for user)
 *   3. Wait for process exit as the completion signal
 *   4. Capture git diff HEAD as the session artifact
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

    // Pre-flight: verify provider credentials before launching opencode.
    const authCheck = await checkProviderAuth(input.codingPersona.provider || input.codingPersona.model)
    if (!authCheck.ok) {
      throw new Error(authCheck.errorMessage!)
    }

    const { providerID, modelID } = normalizeModel(input.codingPersona.model, input.codingPersona.provider)

    // Build the coding prompt — include the task description and any plan context
    const prompt = [
      `IMPORTANT: Do not ask for confirmation or clarification. Proceed immediately and completely.`,
      ``,
      `## Task`,
      `Title: ${input.taskTitle}`,
      ``,
      input.taskDescription,
    ].join("\n")

    await onEvent("CODING_EVENT", {
      status: "launching",
      message: "Launching OpenCode TUI — monitor progress in the terminal window",
      model: `${providerID}/${modelID}`,
    })
    await logEvent(logPath, "CODING_EVENT", { status: "launching", model: `${providerID}/${modelID}` })

    // Launch opencode in a new gnome-terminal window so the user can watch progress.
    // --wait blocks until the terminal window is closed, giving us a clean completion signal.
    const tmpDir = join(tmpdir(), "dash-ai-coding")
    mkdirSync(tmpDir, { recursive: true })
    const scriptPath = join(tmpDir, `${input.taskId}.sh`)
    writeFileSync(scriptPath, [
      `#!/bin/bash`,
      `cd ${JSON.stringify(input.repoPath)}`,
      `opencode-cli run --model ${JSON.stringify(`${providerID}/${modelID}`)} ${JSON.stringify(prompt)}`,
      `echo "OpenCode session finished (exit $?). Close this window to continue."`,
      `read -p ""`,
    ].join("\n"), { mode: 0o755 })

    const ocProcess = spawn(
      "gnome-terminal",
      ["--wait", "--", "bash", scriptPath],
      {
        cwd: input.repoPath,
        stdio: "ignore",
        detached: false,
        env: { ...process.env },
      }
    )

    // 20-minute timeout for a coding session
    const SESSION_TIMEOUT_MS = 20 * 60 * 1000
    const startTime = Date.now()
    const deadline = startTime + SESSION_TIMEOUT_MS

    const exitCode = await new Promise<number | null>((resolve, reject) => {
      const heartbeatInterval = setInterval(async () => {
        if (Date.now() > deadline) {
          clearInterval(heartbeatInterval)
          ocProcess.kill()
          reject(new Error(`Coding session timed out after ${SESSION_TIMEOUT_MS / 60000} minutes`))
          return
        }
        const elapsed = Math.round((Date.now() - startTime) / 1000)
        await onEvent("CODING_EVENT", {
          status: "running",
          message: "OpenCode TUI is running — check your terminal for progress",
          elapsed,
        })
        await logEvent(logPath, "CODING_EVENT", { status: "running", elapsed })
      }, 10_000)

      ocProcess.on("exit", (code) => {
        clearInterval(heartbeatInterval)
        resolve(code)
      })

      ocProcess.on("error", (err) => {
        clearInterval(heartbeatInterval)
        reject(err)
      })
    })

    // Exit code 0 = clean finish. 130 = Ctrl+C, 137 = SIGKILL (terminal window closed).
    // Both mean the user dismissed the terminal after the session completed — treat as success.
    const successCodes = new Set([0, 130, 137])
    if (exitCode !== null && !successCodes.has(exitCode)) {
      throw new Error(`opencode exited with code ${exitCode}`)
    }

    await onEvent("CODING_EVENT", { status: "session_finished", message: "Coding session finished, capturing diff" })
    await logEvent(logPath, "CODING_EVENT", { status: "session_finished" })

    // Capture git diff HEAD as the session artifact
    try {
      const { stdout } = await execAsync("git diff HEAD", { cwd: input.repoPath })
      if (stdout) {
        await appendFile(diffPath, stdout)
        await logEvent(logPath, "CODING_EVENT", { status: "diff_captured", source: "git" })
      } else {
        await logEvent(logPath, "CODING_EVENT", { status: "diff_empty", message: "No changes detected" })
      }
    } catch {
      await logEvent(logPath, "CODING_EVENT", { status: "diff_skipped", message: "git diff failed" })
    }

    await onEvent("CODING_EVENT", { status: "completed", message: "Coding session complete" })
    await logEvent(logPath, "CODING_EVENT", { status: "completed" })

    return {
      success: true,
      sessionId: input.taskId,   // no opencode sessionId in this approach; use taskId
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
  }
}
