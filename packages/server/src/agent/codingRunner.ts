import { homedir } from "os"
import { join, normalize } from "path"
import { mkdir, appendFile } from "fs/promises"
import { existsSync, readdirSync, statSync } from "fs"
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
import * as settingsService from "../services/settingsService"
import { registerCodingSession, unregisterCodingSession } from "./sessionRegistry"

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
  noChanges?: boolean
}

type RunnerThinkingLevel = "low" | "medium" | "high"

interface CodingRunnerHooks {
  onSessionReady?: (meta: { sessionId: string; selectedPlanFile: string; workItemDir: string }) => Promise<void> | void
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
const TEXT_CHUNK_SIZE = 240

function listFilesRecursive(dir: string, base = ""): string[] {
  const results: string[] = []
  for (const entry of readdirSync(dir, { withFileTypes: true })) {
    const rel = base ? `${base}/${entry.name}` : entry.name
    const full = join(dir, entry.name)
    if (entry.isDirectory()) {
      results.push(...listFilesRecursive(full, rel))
    } else {
      results.push(rel)
    }
  }
  return results
}

function normalizeRepoRelativePath(pathValue: string): string {
  return normalize(pathValue).replace(/\\/g, "/").replace(/^\.\//, "")
}

function resolveExecutionTarget(repoPath: string, planPath: string): {
  workItemDir: string
  selectedPlanFile: string
  availablePlanFiles: string[]
} {
  if (!planPath) {
    throw new Error("Cannot run coding session without a planPath")
  }

  const planningRoot = join(repoPath, ".planning")
  const fullPath = join(planningRoot, planPath)
  if (!existsSync(fullPath)) {
    throw new Error(`Plan path not found: .planning/${planPath}`)
  }

  if (statSync(fullPath).isFile()) {
    return {
      workItemDir: `.planning/${planPath.split("/").slice(0, -1).join("/")}`,
      selectedPlanFile: `.planning/${planPath}`,
      availablePlanFiles: [`.planning/${planPath}`],
    }
  }

  const files = listFilesRecursive(fullPath)
  const executionDoc = files.find((file) => file === "EXECUTION.md")
  const planFiles = files
    .filter((file) => file.endsWith("PLAN.md"))
    .sort((a, b) => a.localeCompare(b))

  const unexecutedPlan = planFiles.find((file) => !files.includes(file.replace(/PLAN\.md$/, "SUMMARY.md")))
  const selected = unexecutedPlan || executionDoc || planFiles[0]

  if (!selected) {
    throw new Error(`No PLAN.md or EXECUTION.md found under .planning/${planPath}`)
  }

  return {
    workItemDir: `.planning/${planPath}`,
    selectedPlanFile: `.planning/${planPath}/${selected}`,
    availablePlanFiles: [
      ...(executionDoc ? [`.planning/${planPath}/${executionDoc}`] : []),
      ...planFiles.map((file) => `.planning/${planPath}/${file}`),
    ],
  }
}

async function resolveCodingThinkingLevel(): Promise<RunnerThinkingLevel> {
  const settings = await settingsService.getDefaultSettings()
  return settings.codingThinkingLevel || "medium"
}

function isAllowedPlanningArtifactPath(pathValue: string, workItemDir: string): boolean {
  const normalizedPath = normalizeRepoRelativePath(pathValue)
  if (!normalizedPath.startsWith(".planning/")) return true
  const normalizedWorkItemDir = normalizeRepoRelativePath(workItemDir)
  return normalizedPath === normalizedWorkItemDir || normalizedPath.startsWith(`${normalizedWorkItemDir}/`)
}

export async function runCodingSession(
  input: CodingRunnerInput,
  onEvent: (type: string, payload: Record<string, unknown>) => Promise<void>,
  hooks?: CodingRunnerHooks
): Promise<CodingResult> {
  const home = homedir()
  const sessionDir = join(home, ".dash-ai", "sessions", input.taskId)
  const diffDir = join(home, ".dash-ai", "diffs", input.taskId)
  const logPath = join(sessionDir, "session.log")
  const diffPath = join(diffDir, "changes.diff")
  const startTime = Date.now()

  let textBuffer = ""
  let turnCount = 0
  let toolStartCount = 0
  let toolEndCount = 0
  let createdSessionId = ""
  let blockedPlanningPath = ""
  let abortedForPolicy = false

  const flushText = async () => {
    if (!textBuffer) return
    const chunk = textBuffer
    textBuffer = ""
    await onEvent("CODING_EVENT", { status: "agent.text", text: chunk })
  }

  try {
    await mkdir(sessionDir, { recursive: true })
    await mkdir(diffDir, { recursive: true })

    await onEvent("CODING_EVENT", { status: "starting", message: "Starting coding session" })
    await logEvent(logPath, "CODING_EVENT", { status: "starting" })

    const providerID = input.codingPersona.provider || "anthropic"
    const authCheck = await checkProviderAuth(providerID)
    if (!authCheck.ok) throw new Error(authCheck.errorMessage!)

    const model = await resolveModel(providerID, input.codingPersona.model)
    const thinkingLevel = await resolveCodingThinkingLevel()
    const executionTarget = resolveExecutionTarget(input.repoPath, input.planPath)

    await onEvent("CODING_EVENT", {
      status: "launching",
      model: `${model.provider}/${model.id}`,
      thinkingLevel,
      workItemDir: executionTarget.workItemDir,
      selectedPlanFile: executionTarget.selectedPlanFile,
      availablePlanFiles: executionTarget.availablePlanFiles,
    })
    await logEvent(logPath, "CODING_EVENT", {
      status: "launching",
      model: `${model.provider}/${model.id}`,
      thinkingLevel,
      workItemDir: executionTarget.workItemDir,
      selectedPlanFile: executionTarget.selectedPlanFile,
    })

    const loader = new DefaultResourceLoader({
      cwd: input.repoPath,
      systemPrompt: input.codingPersona.systemPrompt,
    })
    await loader.reload()

    const { session } = await createAgentSession({
      cwd: input.repoPath,
      model,
      thinkingLevel,
      tools: createCodingTools(input.repoPath),
      resourceLoader: loader,
      sessionManager: SessionManager.inMemory(),
      settingsManager: SettingsManager.inMemory({ compaction: { enabled: true } }),
    })

    createdSessionId = session.sessionId
    registerCodingSession(input.taskId, { abort: () => session.abort() })
    await hooks?.onSessionReady?.({
      sessionId: session.sessionId,
      selectedPlanFile: executionTarget.selectedPlanFile,
      workItemDir: executionTarget.workItemDir,
    })

    session.subscribe((event) => {
      switch (event.type) {
        case "message_update":
          if ((event as any).assistantMessageEvent?.type === "text_delta") {
            textBuffer += (event as any).assistantMessageEvent.delta || ""
            if (textBuffer.length >= TEXT_CHUNK_SIZE) {
              void flushText()
            }
          }
          break
        case "tool_execution_start": {
          toolStartCount++
          const toolName = (event as any).toolName as string | undefined
          const args = (event as any).args as Record<string, unknown> | undefined
          const pathValue = typeof args?.path === "string" ? args.path : ""

          if (["read", "write", "edit"].includes(toolName || "") && pathValue && !isAllowedPlanningArtifactPath(pathValue, executionTarget.workItemDir)) {
            blockedPlanningPath = pathValue
            abortedForPolicy = true
            session.abort()
            return
          }

          onEvent("TOOL_START", { toolName, args })
          break
        }
        case "tool_execution_end":
          toolEndCount++
          onEvent("TOOL_END", { toolName: (event as any).toolName, isError: (event as any).isError })
          break
        case "turn_start":
          turnCount++
          onEvent("TURN_START", { turnIndex: (event as any).turnIndex })
          break
        case "turn_end":
          void flushText()
          onEvent("TURN_END", { turnIndex: (event as any).turnIndex })
          break
        case "agent_end":
          void flushText()
          onEvent("CODING_EVENT", { status: "completed" })
          break
      }
    })

    const timeoutId = setTimeout(() => {
      session.abort()
    }, SESSION_TIMEOUT_MS)

    try {
      await session.prompt(
        [
          `/skill:start-work-run`,
          `You are working in the repo at ${input.repoPath}.`,
          `Work item directory: ${executionTarget.workItemDir}`,
          `Selected execution doc: ${executionTarget.selectedPlanFile}`,
          `Available execution docs: ${executionTarget.availablePlanFiles.join(", ")}`,
          `Task: ${input.taskTitle}`,
          ``,
          input.taskDescription,
          ``,
          `Read the selected execution doc and associated BRIEF.md/ROADMAP.md from the same work item before making changes.`,
          `If the selected execution doc is a PLAN.md, execute that plan. If it is an EXECUTION.md, execute that scaffold.`,
          `Do not read or modify any unrelated .planning work item.`,
        ].join("\n")
      )
    } finally {
      clearTimeout(timeoutId)
      await flushText()
    }

    if (abortedForPolicy && blockedPlanningPath) {
      throw new Error(`Coding session attempted to access unrelated planning artifact: ${blockedPlanningPath}`)
    }

    await onEvent("CODING_EVENT", { status: "session_finished", message: "Coding session finished, capturing diff" })
    await logEvent(logPath, "CODING_EVENT", { status: "session_finished" })

    const diffCaptured = await captureGitDiff(input.repoPath, diffPath)
    if (diffCaptured) {
      await logEvent(logPath, "CODING_EVENT", { status: "diff_captured", source: "git" })
    } else {
      await logEvent(logPath, "CODING_EVENT", { status: "diff_empty", message: "No changes detected" })
    }

    session.dispose()

    await onEvent("CODING_EVENT", {
      status: "summary",
      message: diffCaptured ? "Coding session complete" : "Coding session made no code changes",
      durationMs: Date.now() - startTime,
      turnCount,
      toolStartCount,
      toolEndCount,
      selectedPlanFile: executionTarget.selectedPlanFile,
      workItemDir: executionTarget.workItemDir,
      diffCaptured,
      sessionId: createdSessionId,
    })

    if (!diffCaptured) {
      return {
        success: false,
        sessionId: createdSessionId,
        logPath,
        errorMessage: "Coding session completed with no code changes",
        noChanges: true,
      }
    }

    await onEvent("CODING_EVENT", { status: "completed", message: "Coding session complete" })
    await logEvent(logPath, "CODING_EVENT", { status: "completed" })

    return {
      success: true,
      sessionId: createdSessionId,
      diffPath,
      logPath,
    }
  } catch (error) {
    const errorMessage = error instanceof Error ? error.message : String(error)

    try {
      await flushText()
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
      sessionId: createdSessionId,
      errorMessage,
    }
  } finally {
    unregisterCodingSession(input.taskId)
  }
}
