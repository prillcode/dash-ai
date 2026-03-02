import { homedir, tmpdir } from "os"
import { join } from "path"
import { existsSync, writeFileSync, mkdirSync, readdirSync, statSync } from "fs"
import { spawn } from "child_process"
import { checkProviderAuth } from "./authCheck"

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

/**
 * Run a planning session by launching the opencode TUI in a new terminal window.
 * The user monitors progress directly in opencode. Dash AI polls the opencode
 * server for completion rather than trying to stream events over SSE.
 *
 * Flow:
 *   1. Pre-flight auth check
 *   2. Spawn `opencode run <prompt>` in the repo directory (opens TUI for user)
 *   3. Poll the opencode process exit / a separate opencode serve instance for finish
 *
 * Since opencode run is a foreground TUI process, we detect completion by waiting
 * for the spawned process to exit. The TUI handles all visual progress for the user.
 */
export async function runPlanningSession(
  input: PlanningRunnerInput,
  onEvent: (type: string, payload: Record<string, unknown>) => Promise<void>
): Promise<PlanningResult> {
  try {
    await onEvent("PLANNING_EVENT", { status: "starting", message: "Starting planning session" })

    // Pre-flight: verify provider credentials before launching opencode.
    const authCheck = await checkProviderAuth(input.planningPersona.provider || input.planningPersona.model)
    if (!authCheck.ok) {
      throw new Error(authCheck.errorMessage!)
    }

    const { providerID, modelID } = normalizeModel(input.planningPersona.model, input.planningPersona.provider)
    const prompt = buildPlanningPrompt(input)

    await onEvent("PLANNING_EVENT", {
      status: "launching",
      message: "Launching OpenCode TUI — monitor progress in the terminal window",
      model: `${providerID}/${modelID}`,
    })

    // Launch opencode in a new gnome-terminal window so the user can watch progress.
    // --wait blocks until the terminal window is closed, giving us a clean completion signal.
    // We pass the prompt via a temp shell script to avoid shell quoting issues with
    // multi-line prompts containing special characters.
    const tmpDir = join(tmpdir(), "dash-ai-planning")
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
        stdio: "ignore",   // gnome-terminal manages its own terminal; no stdio needed
        detached: false,
        env: { ...process.env },
      }
    )

    // Poll every 10s to emit heartbeat events to the Dash AI UI while we wait.
    const SESSION_TIMEOUT_MS = 20 * 60 * 1000   // 20 minutes for planning
    const deadline = Date.now() + SESSION_TIMEOUT_MS

    const exitCode = await new Promise<number | null>((resolve, reject) => {
      let heartbeatInterval: ReturnType<typeof setInterval>

      heartbeatInterval = setInterval(async () => {
        if (Date.now() > deadline) {
          clearInterval(heartbeatInterval)
          ocProcess.kill()
          reject(new Error(`Planning session timed out after ${SESSION_TIMEOUT_MS / 60000} minutes`))
          return
        }
        await onEvent("PLANNING_EVENT", {
          status: "running",
          message: "OpenCode TUI is running — check your terminal for progress",
          elapsed: Math.round((Date.now() - (deadline - SESSION_TIMEOUT_MS)) / 1000),
        })
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

    await onEvent("PLANNING_EVENT", { status: "completed", message: "Planning session finished" })

    // Find the most recently modified subdirectory under .planning/ — that's the one
    // the agent just created. Store only the folder name (not the full path) so that
    // readPlanDoc can join repoPath + ".planning" + folderName correctly.
    const planningDir = join(input.repoPath, ".planning")
    let planFolder = ""
    try {
      const entries = readdirSync(planningDir, { withFileTypes: true })
      const dirs = entries
        .filter((e) => e.isDirectory())
        .map((e) => ({ name: e.name, mtime: statSync(join(planningDir, e.name)).mtimeMs }))
        .sort((a, b) => b.mtime - a.mtime)
      if (dirs.length > 0) planFolder = dirs[0].name
    } catch {
      // .planning/ doesn't exist yet — leave planFolder empty
    }

    return {
      success: true,
      planDocPath: planFolder,
    }
  } catch (error) {
    const errorMessage = error instanceof Error ? error.message : String(error)
    await onEvent("ERROR", {
      message: errorMessage,
      stack: error instanceof Error ? error.stack : undefined,
    })

    return {
      success: false,
      planDocPath: "",
      errorMessage,
    }
  }
}
