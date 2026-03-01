import { homedir } from "os"
import { join } from "path"
import { promisify } from "util"
import { exec } from "child_process"
import { mkdir, writeFile } from "fs/promises"
import type { Config } from "@opencode-ai/sdk"
import { normalizeModel } from "./planningRunner"

const execAsync = promisify(exec)

export interface CodingRunnerInput {
  taskId: string
  taskTitle: string
  taskDescription: string
  repoPath: string          // resolved (no ~)
  planPath: string          // e.g. "pcw-101-my-task" — relative to repoPath/.planning/
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
    /permission denied/i
  ]
  return patterns.some(pattern => pattern.test(errorText))
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

  try {
    await mkdir(sessionDir, { recursive: true })
    await mkdir(diffDir, { recursive: true })

    // Import SDK dynamically
    let createOpencode: any
    try {
      const sdk = await import("@opencode-ai/sdk")
      createOpencode = sdk.createOpencode
    } catch (importError: any) {
      if (importError.code === 'MODULE_NOT_FOUND') {
        await onEvent("ERROR", {
          message: "OpenCode SDK not found — install @opencode-ai/sdk",
          stack: "Coding session runner is a placeholder. To enable real coding, install the OpenCode SDK."
        })
        // Write placeholder log and diff as before
        const logContent = `[${new Date().toISOString()}] Coding session placeholder for task ${input.taskId}\n`
        await writeFile(logPath, logContent)
        try {
          const { stdout } = await execAsync("git diff HEAD", { cwd: input.repoPath })
          await writeFile(diffPath, stdout)
        } catch (gitError) {}

        return {
          success: false,
          sessionId: `coding-${input.taskId}-${Date.now()}`,
          diffPath,
          logPath,
          errorMessage: "OpenCode SDK not found — install @opencode-ai/sdk"
        }
      }
      throw importError
    }

    // Start OpenCode server
    const { client, server } = await createOpencode({
      config: {
        // No config needed; SDK reads environment variables
      }
    })

    await onEvent("CODING_EVENT", { status: "creating_session", message: "Creating coding session" })

    // Create a new session in the repository directory
    const session = await client.session.create({
      query: { directory: input.repoPath },
      body: { title: `Code: ${input.taskTitle}` }
    })

    if (!session || !session.id) {
      throw new Error("Failed to create session")
    }

    const sessionId = session.id
    await onEvent("CODING_EVENT", { status: "session_created", sessionId })

    // Normalize model to OpenCode format (provider/model-id)
    const normalizedModel = normalizeModel(input.codingPersona.model, input.codingPersona.provider)

    // Send a prompt with the task description
    await onEvent("CODING_EVENT", { status: "sending_prompt", message: "Sending coding prompt" })
    
    const promptResult = await client.session.prompt({
      path: { id: sessionId },
      query: { directory: input.repoPath },
      body: {
         model: normalizedModel,
        agent: "build",
        system: input.codingPersona.systemPrompt,
        tools: input.codingPersona.allowedTools.reduce((acc, tool) => ({ ...acc, [tool]: true }), {}),
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

    await onEvent("CODING_EVENT", { status: "prompt_sent", message: "Coding prompt sent" })

    // Wait for session to become idle (simple polling)
    await onEvent("CODING_EVENT", { status: "waiting", message: "Waiting for coding to complete" })
    // TODO: Implement proper event streaming and completion detection
    await new Promise(resolve => setTimeout(resolve, 10000))

    // Get diff from session
    const diffResult = await client.session.diff({
      path: { id: sessionId },
      query: { directory: input.repoPath }
    })

    // Write diff to file
    if (diffResult.diff && Array.isArray(diffResult.diff)) {
      const diffText = diffResult.diff.map((fileDiff: any) => 
        `--- ${fileDiff.file}\n+++ ${fileDiff.file}\n${fileDiff.before}\n${fileDiff.after}`
      ).join('\n')
      await writeFile(diffPath, diffText)
    } else {
      // Fallback to git diff
      try {
        const { stdout } = await execAsync("git diff HEAD", { cwd: input.repoPath })
        await writeFile(diffPath, stdout)
      } catch (gitError) {}
    }

    // Write session log (simplified)
    const logContent = `[${new Date().toISOString()}] Coding session ${sessionId} completed\n`
    await writeFile(logPath, logContent)

    // Stop the server
    server.close()

    await onEvent("CODING_EVENT", { status: "completed", message: "Coding session finished" })

    return {
      success: true,
      sessionId,
      diffPath,
      logPath
    }

  } catch (error) {
    const errorMessage = error instanceof Error ? error.message : String(error)
    
    // Detect auth errors in caught error
    if (detectAuthError(errorMessage)) {
      await onEvent("ERROR", {
        message: errorMessage,
        stack: error instanceof Error ? error.stack : undefined
      })
      return {
        success: false,
        sessionId: "",
        errorMessage: "Authentication failed. OpenCode SDK reads credentials from ~/.local/share/opencode/auth.json.\n" +
                      "Use '/connect' in OpenCode TUI/IDE to add providers, or set environment variables (ANTHROPIC_API_KEY, DEEPSEEK_API_KEY, etc.)."
      }
    }

    await onEvent("ERROR", {
      message: errorMessage,
      stack: error instanceof Error ? error.stack : undefined
    })
    return {
      success: false,
      sessionId: "",
      errorMessage: `Coding session error: ${errorMessage}`
    }
  }
}