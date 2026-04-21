import { stat, readFile, writeFile } from "fs/promises"
import { existsSync } from "fs"
import { join } from "path"
import {
  createAgentSession,
  createCodingTools,
  DefaultResourceLoader,
  SessionManager,
  SettingsManager,
} from "@mariozechner/pi-coding-agent"
import { resolveModel, getModelRegistry } from "../agent/piSession"
import * as projectService from "./projectService"
import * as settingsService from "./settingsService"

const AGENT_MD_FILENAME = "Agent.md"
const SESSION_TIMEOUT_MS = 10 * 60 * 1000
const MAX_FILE_CHARS = 12_000

export class AgentMdOverwriteRequiredError extends Error {
  constructor(public filePath: string) {
    super("Agent.md already exists and overwrite was not confirmed")
    this.name = "AgentMdOverwriteRequiredError"
  }
}

export class AgentMdGenerationError extends Error {
  constructor(
    message: string,
    public diagnostics: AgentMdGenerationDiagnostics
  ) {
    super(message)
    this.name = "AgentMdGenerationError"
  }
}

export interface AgentMdSnapshot {
  exists: boolean
  path: string
  content?: string
  updatedAt?: string
}

export interface GenerateAgentMdResult extends AgentMdSnapshot {
  generated: boolean
  overwritten: boolean
  provider: string
  model: string
}

export interface AgentMdGenerationDiagnostics {
  projectPath: string
  outputPath: string
  model: string
  provider: string
  assistantTextPreview?: string
  assistantTextLength: number
  fallbackWriteAttempted: boolean
  fallbackWriteSucceeded: boolean
  fileExistsAfterSession: boolean
  fileExistsAfterFallback: boolean
  promptResolved: boolean
  promptError?: string
  eventTrace: string[]
}

function getAgentMdPath(projectPath: string): string {
  return join(projectPath, AGENT_MD_FILENAME)
}

async function readTextFileIfExists(path: string): Promise<string | null> {
  try {
    const content = await readFile(path, "utf8")
    return content.length > MAX_FILE_CHARS
      ? `${content.slice(0, MAX_FILE_CHARS)}\n\n[truncated]`
      : content
  } catch {
    return null
  }
}

async function getTopLevelEntries(projectPath: string): Promise<{ directories: string[]; files: string[] }> {
  try {
    const dirents = await (await import("fs/promises")).readdir(projectPath, { withFileTypes: true })
    const ignored = new Set([".git", "node_modules", "dist", "build", ".next", "coverage", ".turbo"])
    const directories = dirents
      .filter((entry) => entry.isDirectory() && !ignored.has(entry.name))
      .map((entry) => entry.name)
      .sort()
      .slice(0, 25)
    const files = dirents
      .filter((entry) => entry.isFile())
      .map((entry) => entry.name)
      .sort()
      .slice(0, 25)
    return { directories, files }
  } catch {
    return { directories: [], files: [] }
  }
}

async function buildProjectAnalysis(projectPath: string): Promise<string> {
  const packageJson = await readTextFileIfExists(join(projectPath, "package.json"))
  const tsconfig = await readTextFileIfExists(join(projectPath, "tsconfig.json"))
  const tsconfigBase = await readTextFileIfExists(join(projectPath, "tsconfig.base.json"))
  const readme =
    (await readTextFileIfExists(join(projectPath, "README.md"))) ||
    (await readTextFileIfExists(join(projectPath, "README")))
  const existingAgents = await readTextFileIfExists(join(projectPath, "AGENTS.md"))
  const topLevel = await getTopLevelEntries(projectPath)

  return [
    `Project root: ${projectPath}`,
    "",
    "Top-level directories:",
    topLevel.directories.length > 0 ? topLevel.directories.map((dir) => `- ${dir}`).join("\n") : "- None detected",
    "",
    "Top-level files:",
    topLevel.files.length > 0 ? topLevel.files.map((file) => `- ${file}`).join("\n") : "- None detected",
    "",
    "package.json:",
    packageJson || "Not found",
    "",
    "tsconfig.json:",
    tsconfig || "Not found",
    "",
    "tsconfig.base.json:",
    tsconfigBase || "Not found",
    "",
    "README:",
    readme || "Not found",
    "",
    "Existing AGENTS.md:",
    existingAgents || "Not found",
  ].join("\n")
}

async function readSnapshot(projectPath: string): Promise<AgentMdSnapshot> {
  const path = getAgentMdPath(projectPath)
  if (!existsSync(path)) {
    return { exists: false, path }
  }

  const [content, fileStat] = await Promise.all([readFile(path, "utf8"), stat(path)])
  return {
    exists: true,
    path,
    content,
    updatedAt: fileStat.mtime.toISOString(),
  }
}

async function resolveGenerationTarget(settings: settingsService.DefaultSettings): Promise<{ provider: string; model: string }> {
  if (settings.defaultProvider && settings.defaultModel) {
    return {
      provider: settings.defaultProvider,
      model: settings.defaultModel,
    }
  }

  const available = await getModelRegistry().getAvailable()
  if (available.length === 0) {
    throw new Error("No AI models available. Configure Pi auth or API keys first.")
  }

  return {
    provider: settings.defaultProvider || available[0].provider,
    model: settings.defaultModel || available[0].id,
  }
}

export async function getAgentMd(projectId: string): Promise<AgentMdSnapshot> {
  const project = await projectService.getProject(projectId)
  if (!project) throw new Error("Project not found")
  return readSnapshot(project.resolvedPath)
}

export async function generateAgentMd(
  projectId: string,
  options?: { overwrite?: boolean }
): Promise<GenerateAgentMdResult> {
  const project = await projectService.getProject(projectId)
  if (!project) throw new Error("Project not found")

  const before = await readSnapshot(project.resolvedPath)
  if (before.exists && !options?.overwrite) {
    throw new AgentMdOverwriteRequiredError(before.path)
  }

  const settings = await settingsService.getDefaultSettings()
  const target = await resolveGenerationTarget(settings)
  const model = await resolveModel(target.provider, target.model)
  const projectAnalysis = await buildProjectAnalysis(project.resolvedPath)
  const outputPath = getAgentMdPath(project.resolvedPath)

  const loader = new DefaultResourceLoader({
    cwd: project.resolvedPath,
    systemPrompt:
      "You generate concise, repo-specific Agent.md files. Prefer concrete conventions over generic advice. Only modify Agent.md unless explicitly told otherwise.",
  })
  await loader.reload()

  const { session } = await createAgentSession({
    cwd: project.resolvedPath,
    model,
    thinkingLevel: "medium",
    tools: createCodingTools(project.resolvedPath),
    resourceLoader: loader,
    sessionManager: SessionManager.inMemory(),
    settingsManager: SettingsManager.inMemory({ compaction: { enabled: true } }),
  })

  let assistantText = ""
  let fallbackWriteAttempted = false
  let fallbackWriteSucceeded = false
  let promptResolved = false
  let promptError: string | undefined
  const eventTrace: string[] = []
  const pushTrace = (entry: string) => {
    if (eventTrace.length < 50) eventTrace.push(entry)
  }

  session.subscribe((event) => {
    switch (event.type) {
      case "message_update": {
        const assistantEvent = (event as any).assistantMessageEvent
        if (assistantEvent?.type === "text_delta") {
          assistantText += assistantEvent.delta || ""
          pushTrace(`message_update:text_delta:${String(assistantEvent.delta || "").length}`)
        } else {
          pushTrace(`message_update:${assistantEvent?.type || "unknown"}`)
        }
        break
      }
      case "tool_execution_start":
        pushTrace(`tool_start:${(event as any).toolName || "unknown"}`)
        break
      case "tool_execution_end":
        pushTrace(`tool_end:${(event as any).toolName || "unknown"}:${(event as any).isError ? "error" : "ok"}`)
        break
      case "turn_start":
        pushTrace(`turn_start:${(event as any).turnIndex ?? "?"}`)
        break
      case "turn_end":
        pushTrace(`turn_end:${(event as any).turnIndex ?? "?"}`)
        break
      case "agent_end":
        pushTrace("agent_end")
        break
      default:
        pushTrace(`event:${event.type}`)
        break
    }
  })

  const timeoutId = setTimeout(() => session.abort(), SESSION_TIMEOUT_MS)

  try {
    await session.prompt(
      [
        "Generate a project-level Agent.md file for this repository.",
        `Write the output to ./${AGENT_MD_FILENAME}.`,
        before.exists
          ? "An Agent.md file already exists. Overwrite it completely with the new content."
          : "Create a new Agent.md file.",
        "Do not modify any other files.",
        "Keep the document concise, specific to this repository, and easy for an AI coding agent to scan.",
        "Use markdown headings and bullet lists. Avoid long paragraphs.",
        "Prefer concrete commands, conventions, directories, and gotchas from the repository.",
        "If information is missing, omit it rather than guessing.",
        "",
        "Prompt from application settings:",
        settings.agentMdPrompt || settingsService.DEFAULT_AGENT_MD_PROMPT,
        "",
        "Project analysis context:",
        projectAnalysis,
        "",
        "When finished, ensure the file exists on disk and then stop.",
        "If you choose not to use tools, output only the final Agent.md markdown content with no surrounding commentary.",
      ].join("\n")
    )
    promptResolved = true
  } catch (error) {
    promptError = error instanceof Error ? error.message : String(error)
    pushTrace(`prompt_error:${promptError}`)
    throw error
  } finally {
    clearTimeout(timeoutId)
    session.dispose()
  }

  let after = await readSnapshot(project.resolvedPath)
  const fileExistsAfterSession = after.exists && Boolean(after.content?.trim())

  if ((!after.exists || !after.content?.trim()) && assistantText.trim()) {
    const cleaned = assistantText
      .trim()
      .replace(/^```(?:markdown|md)?\s*/i, "")
      .replace(/\s*```$/, "")
      .trim()

    if (cleaned) {
      fallbackWriteAttempted = true
      await writeFile(outputPath, `${cleaned}\n`, "utf8")
      after = await readSnapshot(project.resolvedPath)
      fallbackWriteSucceeded = after.exists && Boolean(after.content?.trim())
    }
  }

  if (!after.exists || !after.content?.trim()) {
    throw new AgentMdGenerationError(
      "Agent.md generation completed but no Agent.md file was written",
      {
        projectPath: project.resolvedPath,
        outputPath,
        model: model.id,
        provider: model.provider,
        assistantTextPreview: assistantText.trim().slice(0, 1000) || undefined,
        assistantTextLength: assistantText.length,
        fallbackWriteAttempted,
        fallbackWriteSucceeded,
        fileExistsAfterSession,
        fileExistsAfterFallback: after.exists && Boolean(after.content?.trim()),
        promptResolved,
        promptError,
        eventTrace,
      }
    )
  }

  return {
    ...after,
    generated: true,
    overwritten: before.exists,
    provider: model.provider,
    model: model.id,
  }
}
