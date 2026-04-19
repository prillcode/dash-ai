import { homedir } from "os"
import { join } from "path"
import { readdirSync, statSync } from "fs"
import {
  createAgentSession,
  SessionManager,
  createReadOnlyTools,
  DefaultResourceLoader,
  SettingsManager,
} from "@mariozechner/pi-coding-agent"
import { resolveModel, checkProviderAuth } from "./piSession"

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

const SESSION_TIMEOUT_MS = 20 * 60 * 1000 // 20 minutes

/**
 * Find the most recently modified subdirectory under .planning/ — that's the one
 * the agent just created. Store only the folder name (not the full path) so that
 * readPlanDoc can join repoPath + ".planning" + folderName correctly.
 */
function findLatestPlanDir(repoPath: string): string {
  const planningDir = join(repoPath, ".planning")
  try {
    const entries = readdirSync(planningDir, { withFileTypes: true })
    const dirs = entries
      .filter((e) => e.isDirectory())
      .map((e) => ({ name: e.name, mtime: statSync(join(planningDir, e.name)).mtimeMs }))
      .sort((a, b) => b.mtime - a.mtime)
    if (dirs.length > 0) return dirs[0].name
  } catch {
    // .planning/ doesn't exist yet
  }
  return ""
}

/**
 * Run a planning session using Pi SDK with in-process agent sessions.
 * Invokes /skill:start-work-begin for scaffolding and /skill:start-work-plan
 * for deepening phases into executable PLAN.md files.
 */
export async function runPlanningSession(
  input: PlanningRunnerInput,
  onEvent: (type: string, payload: Record<string, unknown>) => Promise<void>
): Promise<PlanningResult> {
  try {
    await onEvent("PLANNING_EVENT", { status: "starting", message: "Starting planning session" })

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
      thinkingLevel: "high",
      tools: createReadOnlyTools(input.repoPath),
      resourceLoader: loader,
      sessionManager: SessionManager.inMemory(),
      settingsManager: SettingsManager.inMemory({ compaction: { enabled: true } }),
    })

    // Subscribe to events and forward to Dash AI's event system
    session.subscribe((event) => {
      switch (event.type) {
        case "message_update":
          if ((event as any).assistantMessageEvent?.type === "text_delta") {
            onEvent("PLANNING_TEXT", { delta: (event as any).assistantMessageEvent.delta })
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
          onEvent("PLANNING_EVENT", { status: "completed" })
          break
      }
    })

    // Timeout wrapper
    const timeoutId = setTimeout(() => {
      session.abort()
    }, SESSION_TIMEOUT_MS)

    try {
      if (input.planFeedback) {
        // Iteration: the .planning/ scaffold already exists, re-plan with feedback
        await session.prompt(
          [
            `/skill:start-work-plan`,
            `The user reviewed the plan and provided this feedback:`,
            ``,
            input.planFeedback,
            ``,
            `Refine the affected phase plans accordingly.`,
          ].join("\n")
        )
      } else {
        // Fresh planning: scaffold then deepen

        // Derive a kebab-case work name from the task title
        const workName = input.taskTitle
          .toLowerCase()
          .replace(/[^a-z0-9]+/g, "-")
          .replace(/^-|-$/g, "")
          .slice(0, 40)

        // Phase 1: Scaffold the work item using start-work-begin
        await session.prompt(
          [
            `/skill:start-work-begin`,
            `Identifier: ${input.taskIdentifier || "(auto-generate)"}`,
            `Work name: ${workName}`,
            `Work type: Feature`,
            `Description: ${input.taskDescription}`,
            input.targetFiles?.length ? `Relevant files: ${input.targetFiles.join(", ")}` : "",
          ].filter(Boolean).join("\n")
        )

        // Phase 2: Deepen the roadmap into executable plans using start-work-plan
        await session.prompt(
          `/skill:start-work-plan — expand all phases in the roadmap into detailed PLAN.md files`
        )
      }
    } finally {
      clearTimeout(timeoutId)
    }

    // Find the plan docs written under .planning/
    const planDocPath = findLatestPlanDir(input.repoPath)

    session.dispose()

    await onEvent("PLANNING_EVENT", { status: "completed", message: "Planning session finished" })

    return { success: true, planDocPath }
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
