import { join, normalize } from "path"
import { readdirSync, statSync } from "fs"
import {
  createAgentSession,
  SessionManager,
  createCodingTools,
  DefaultResourceLoader,
  SettingsManager,
} from "@mariozechner/pi-coding-agent"
import { resolveModel, checkProviderAuth } from "./piSession"
import * as settingsService from "../services/settingsService"

export interface PlanningRunnerInput {
  taskId: string
  taskTitle: string
  taskDescription: string
  taskIdentifier?: string
  targetFiles?: string[]
  repoPath: string
  planPath?: string
  planFeedback?: string
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

type RunnerThinkingLevel = "low" | "medium" | "high"
type PlanningMode = "fast" | "full"

interface PlanningRunConfig {
  mode: PlanningMode
  thinkingLevel: RunnerThinkingLevel
  allowRelatedWorkItems: boolean
}

const SESSION_TIMEOUT_MS = 20 * 60 * 1000 // 20 minutes
const TEXT_CHUNK_SIZE = 240

function listPlanDirs(repoPath: string): Array<{ name: string; mtime: number }> {
  const planningDir = join(repoPath, ".planning")
  try {
    return readdirSync(planningDir, { withFileTypes: true })
      .filter((e) => e.isDirectory())
      .map((e) => ({ name: e.name, mtime: statSync(join(planningDir, e.name)).mtimeMs }))
      .sort((a, b) => b.mtime - a.mtime)
  } catch {
    return []
  }
}

function findLatestPlanDir(repoPath: string): string {
  return listPlanDirs(repoPath)[0]?.name || ""
}

function deriveWorkName(taskTitle: string): string {
  return taskTitle
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-|-$/g, "")
    .slice(0, 40)
}

function matchesPlanDir(name: string, expectedPrefix: string): boolean {
  return name === expectedPrefix || name.startsWith(`${expectedPrefix}-`)
}

function detectCreatedPlanDir(repoPath: string, beforeNames: string[], expectedPrefix: string): string {
  const dirs = listPlanDirs(repoPath)
  const before = new Set(beforeNames)

  return dirs.find((dir) => !before.has(dir.name) && matchesPlanDir(dir.name, expectedPrefix))?.name || ""
}

function normalizeRepoRelativePath(pathValue: string): string {
  return normalize(pathValue).replace(/\\/g, "/").replace(/^\.\//, "")
}

function isAllowedPlanningRead(pathValue: string, expectedPrefix: string, resolvedPlanDir: string, allowRelatedWorkItems: boolean): boolean {
  if (allowRelatedWorkItems) return true

  const normalizedPath = normalizeRepoRelativePath(pathValue)
  if (!normalizedPath.startsWith(".planning/")) return true

  if (resolvedPlanDir) {
    return normalizedPath.startsWith(`.planning/${resolvedPlanDir}/`) || normalizedPath === `.planning/${resolvedPlanDir}`
  }

  return (
    normalizedPath.startsWith(`.planning/${expectedPrefix}/`) ||
    normalizedPath.startsWith(`.planning/${expectedPrefix}-`) ||
    normalizedPath === `.planning/${expectedPrefix}`
  )
}

function shouldUseFastPlanning(input: PlanningRunnerInput): boolean {
  const targetFileCount = input.targetFiles?.length ?? 0
  const descriptionLength = input.taskDescription.trim().length
  const lineCount = input.taskDescription.split(/\r?\n/).filter((line) => line.trim().length > 0).length

  return targetFileCount <= 2 && descriptionLength <= 420 && lineCount <= 6
}

async function resolvePlanningConfig(input: PlanningRunnerInput): Promise<PlanningRunConfig> {
  const settings = await settingsService.getDefaultSettings()
  const settingMode = settings.planningMode ?? "auto"
  const mode: PlanningMode =
    settingMode === "fast"
      ? "fast"
      : settingMode === "full"
        ? "full"
        : shouldUseFastPlanning(input)
          ? "fast"
          : "full"

  const thinkingLevel =
    settings.planningThinkingLevel || (mode === "fast" ? "low" : "medium")

  return {
    mode,
    thinkingLevel,
    allowRelatedWorkItems: settings.planningAllowRelatedWorkItems === true,
  }
}

export async function runPlanningSession(
  input: PlanningRunnerInput,
  onEvent: (type: string, payload: Record<string, unknown>) => Promise<void>
): Promise<PlanningResult> {
  let finalPlanDir = input.planPath || ""
  let textBuffer = ""
  let turnCount = 0
  let toolStartCount = 0
  let toolEndCount = 0
  let blockedReadPath = ""
  let sessionAbortedForPolicy = false
  const startTime = Date.now()

  const flushText = async () => {
    if (!textBuffer) return
    const chunk = textBuffer
    textBuffer = ""
    await onEvent("PLANNING_EVENT", { status: "agent.text", text: chunk })
  }

  try {
    await onEvent("PLANNING_EVENT", { status: "starting", message: "Starting planning session" })

    const config = await resolvePlanningConfig(input)

    // Auth pre-flight
    const providerID = input.planningPersona.provider || "anthropic"
    const authCheck = await checkProviderAuth(providerID)
    if (!authCheck.ok) throw new Error(authCheck.errorMessage!)

    // Resolve model via Pi registry
    const model = await resolveModel(providerID, input.planningPersona.model)

    await onEvent("PLANNING_EVENT", {
      status: "launching",
      message: "Launching planning session",
      model: `${model.provider}/${model.id}`,
      planningMode: config.mode,
      thinkingLevel: config.thinkingLevel,
    })

    // Build resource loader — persona system prompt, Pi discovers skills automatically
    const loader = new DefaultResourceLoader({
      cwd: input.repoPath,
      systemPrompt: input.planningPersona.systemPrompt,
    })
    await loader.reload()

    const { session } = await createAgentSession({
      cwd: input.repoPath,
      model,
      thinkingLevel: config.thinkingLevel,
      tools: createCodingTools(input.repoPath),
      resourceLoader: loader,
      sessionManager: SessionManager.inMemory(),
      settingsManager: SettingsManager.inMemory({ compaction: { enabled: true } }),
    })

    const workName = deriveWorkName(input.taskTitle)
    const expectedPrefix = [input.taskIdentifier, workName].filter(Boolean).join("-").toLowerCase()
    let resolvedPlanDir = finalPlanDir

    // Subscribe to events and forward to Dash AI's event system
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

          if (toolName === "read") {
            const pathValue = typeof args?.path === "string" ? args.path : ""
            if (pathValue && !isAllowedPlanningRead(pathValue, expectedPrefix, resolvedPlanDir, config.allowRelatedWorkItems)) {
              blockedReadPath = pathValue
              sessionAbortedForPolicy = true
              session.abort()
              return
            }
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
          onEvent("PLANNING_EVENT", { status: "completed" })
          break
      }
    })

    // Timeout wrapper
    const timeoutId = setTimeout(() => {
      session.abort()
    }, SESSION_TIMEOUT_MS)

    try {
      const beforePlanDirs = listPlanDirs(input.repoPath).map((dir) => dir.name)

      await onEvent("PLANNING_EVENT", {
        status: "targeting",
        planningMode: config.mode,
        expectedTargetPrefix: expectedPrefix,
        allowRelatedWorkItems: config.allowRelatedWorkItems,
        isIteration: Boolean(input.planFeedback),
      })

      if (input.planFeedback) {
        if (!resolvedPlanDir) {
          throw new Error("Cannot iterate a plan without an existing planPath")
        }

        await session.prompt(
          [
            `/skill:start-work-plan`,
            `Target work item path: .planning/${resolvedPlanDir}`,
            `Refine the existing plan for task: ${input.taskTitle}`,
            `The user reviewed the plan and provided this feedback:`,
            ``,
            input.planFeedback,
            ``,
            `Read BRIEF.md, ROADMAP.md, and existing phase plans only from that work item. Update the affected plan docs in place.`,
            config.allowRelatedWorkItems
              ? `You may inspect related work items only if clearly needed to resolve the user's feedback.`
              : `Do not read or reuse any unrelated .planning work item. Stay inside .planning/${resolvedPlanDir}.`,
          ].join("\n")
        )
      } else if (config.mode === "fast") {
        await session.prompt(
          [
            `/skill:start-work-begin`,
            `Mode: lightweight`,
            `Identifier: ${input.taskIdentifier || "(auto-generate)"}`,
            `Work name: ${workName}`,
            `Work type: Feature`,
            `Description: ${input.taskDescription}`,
            input.targetFiles?.length ? `Relevant files: ${input.targetFiles.join(", ")}` : "",
            `Create the planning scaffold only for the target work item inside this repo's .planning directory.`,
            `The target work item must be named with the prefix: ${expectedPrefix}`,
            `Create a lightweight execution scaffold suitable for straightforward work (BRIEF.md + EXECUTION.md).`,
            `Do not read or reuse any unrelated .planning work item unless explicitly told to research precedents.`,
          ].filter(Boolean).join("\n")
        )

        resolvedPlanDir = detectCreatedPlanDir(input.repoPath, beforePlanDirs, expectedPrefix)
        if (!resolvedPlanDir) {
          throw new Error(`Planning scaffold did not create the expected .planning/${expectedPrefix}* directory`)
        }
      } else {
        await session.prompt(
          [
            `/skill:start-work-begin`,
            `Mode: full`,
            `Identifier: ${input.taskIdentifier || "(auto-generate)"}`,
            `Work name: ${workName}`,
            `Work type: Feature`,
            `Description: ${input.taskDescription}`,
            input.targetFiles?.length ? `Relevant files: ${input.targetFiles.join(", ")}` : "",
            `Create the planning scaffold only for the target work item inside this repo's .planning directory.`,
            `The target work item must be named with the prefix: ${expectedPrefix}`,
            `Do not read or reuse any unrelated .planning work item unless explicitly told to research precedents.`,
          ].filter(Boolean).join("\n")
        )

        resolvedPlanDir = detectCreatedPlanDir(input.repoPath, beforePlanDirs, expectedPrefix)
        if (!resolvedPlanDir) {
          throw new Error(`Planning scaffold did not create the expected .planning/${expectedPrefix}* directory`)
        }

        await onEvent("PLANNING_EVENT", {
          status: "target_resolved",
          planningMode: config.mode,
          expectedTargetPrefix: expectedPrefix,
          detectedPlanDir: resolvedPlanDir,
        })

        await session.prompt(
          [
            `/skill:start-work-plan`,
            `Target work item path: .planning/${resolvedPlanDir}`,
            `Read BRIEF.md and ROADMAP.md only from that work item and create detailed PLAN.md files for the roadmap phases under .planning/${resolvedPlanDir}/phases/.`,
            config.allowRelatedWorkItems
              ? `If a closely related prior work item is absolutely necessary for precedent, cite it explicitly and keep focus on the target work item.`
              : `Do not inspect or reuse any unrelated .planning work item.`,
          ].join("\n")
        )
      }

      finalPlanDir = resolvedPlanDir

      await onEvent("PLANNING_EVENT", {
        status: "target_resolved",
        planningMode: config.mode,
        expectedTargetPrefix: expectedPrefix,
        detectedPlanDir: finalPlanDir,
      })
    } finally {
      clearTimeout(timeoutId)
      await flushText()
    }

    if (sessionAbortedForPolicy && blockedReadPath) {
      throw new Error(
        `Planning session attempted to read unrelated planning artifact: ${blockedReadPath}. Adjust settings to allow related work items if this is intentional.`
      )
    }

    const planDocPath = finalPlanDir || findLatestPlanDir(input.repoPath)

    session.dispose()

    await onEvent("PLANNING_EVENT", {
      status: "summary",
      message: "Planning session finished",
      planDocPath,
      planningMode: config.mode,
      durationMs: Date.now() - startTime,
      turnCount,
      toolStartCount,
      toolEndCount,
    })
    await onEvent("PLANNING_EVENT", { status: "completed", message: "Planning session finished" })

    return { success: true, planDocPath }
  } catch (error) {
    const errorMessage = sessionAbortedForPolicy && blockedReadPath
      ? `Planning session attempted to read unrelated planning artifact: ${blockedReadPath}. Adjust settings to allow related work items if this is intentional.`
      : error instanceof Error ? error.message : String(error)
    await flushText()
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
