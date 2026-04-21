import { eq, desc, asc, and, inArray, isNull } from "drizzle-orm"
import { db } from "../db/client"
import * as projectService from "./projectService"
import { tasks, TaskStatus } from "../db/schema"
import { generateId } from "../utils/id"
import { now } from "../utils/time"
import { readFile, readdir } from "fs/promises"
import { statSync } from "fs"
import { existsSync } from "fs"
import { join } from "path"
import { execSync } from "child_process"

type Task = typeof tasks.$inferSelect
type NewTask = typeof tasks.$inferInsert

export interface TaskInput {
  identifier?: string
  title: string
  description: string
  codingPersonaId: string
  codingPersonaName: string
  planningPersonaId?: string
  planningPersonaName?: string
  projectId: string
  targetFiles?: string[]
  priority?: number
}

export interface TaskFilters {
  status?: string
  personaId?: string
  priority?: number
}

function parseTask(row: Task) {
  return {
    ...row,
    targetFiles: JSON.parse(row.targetFiles),
  }
}

function serializeTask(input: Pick<TaskInput, "targetFiles">) {
  return {
    targetFiles: JSON.stringify(input.targetFiles || []),
  }
}

export async function listTasks(filters: TaskFilters = {}): Promise<Task[]> {
  const conditions = []
  
  if (filters.status) {
    conditions.push(eq(tasks.status, filters.status))
  }
  if (filters.personaId) {
    conditions.push(eq(tasks.codingPersonaId, filters.personaId))
  }
  if (filters.priority !== undefined) {
    conditions.push(eq(tasks.priority, filters.priority))
  }
  
  const query = db.select().from(tasks)
  
  if (conditions.length > 0) {
    const result = await query
      .where(and(...conditions))
      .orderBy(asc(tasks.priority), asc(tasks.createdAt))
    return result.map(parseTask)
  }
  
  const result = await query.orderBy(desc(tasks.createdAt))
  return result.map(parseTask)
}

export async function getTask(id: string): Promise<Task | null> {
  const [row] = await db.select().from(tasks).where(eq(tasks.id, id))
  return row ? parseTask(row) : null
}

export async function createTask(input: TaskInput): Promise<Task> {
  const project = await projectService.getProject(input.projectId)
  if (!project) {
    throw new Error(`Project ${input.projectId} not found`)
  }
  const id = generateId()
  const timestamp = now()
  const serialized = serializeTask(input)
  
  const [row] = await db.insert(tasks).values({
    id,
    identifier: input.identifier ?? null,
    title: input.title,
    description: input.description,
    codingPersonaId: input.codingPersonaId,
    codingPersonaName: input.codingPersonaName,
    planningPersonaId: input.planningPersonaId ?? null,
    planningPersonaName: input.planningPersonaName ?? null,
    status: TaskStatus.DRAFT,
    priority: input.priority ?? 3,
    projectId: input.projectId,
    repoPath: project.resolvedPath,
    targetFiles: serialized.targetFiles,
    createdAt: timestamp,
    updatedAt: timestamp,
  } as NewTask).returning()
  
  return parseTask(row)
}

export async function updateTaskStatus(
  id: string,
  status: string,
  extra?: Partial<Pick<Task, "diffPath" | "outputLog" | "sessionId" | "errorMessage" | "reviewedBy" | "reviewNote" | "startedAt" | "completedAt" | "planFeedback" | "planPath" | "planningPersonaId" | "planningPersonaName">>
): Promise<Task | null> {
  const [row] = await db.update(tasks)
    .set({
      status,
      ...extra,
      updatedAt: now(),
    } as Partial<Task>)
    .where(eq(tasks.id, id))
    .returning()
  
  return row ? parseTask(row) : null
}

export async function claimNextReadyTask(): Promise<Task | null> {
  const [row] = await db.update(tasks)
    .set({ status: TaskStatus.QUEUED, updatedAt: now() })
    .where(eq(tasks.id, db
      .select({ id: tasks.id })
      .from(tasks)
      .where(eq(tasks.status, TaskStatus.READY_TO_CODE))
      .orderBy(asc(tasks.priority), asc(tasks.createdAt))
      .limit(1)
    ))
    .returning()
  
  return row ? parseTask(row) : null
}

export async function claimNextPlanningTask(): Promise<Task | null> {
  const sessionId = `planning-${generateId()}`
  const [row] = await db.update(tasks)
    .set({ sessionId, updatedAt: now() })
    .where(eq(tasks.id, db
      .select({ id: tasks.id })
      .from(tasks)
      .where(and(
        eq(tasks.status, TaskStatus.IN_PLANNING),
        isNull(tasks.sessionId)
      ))
      .orderBy(asc(tasks.priority), asc(tasks.createdAt))
      .limit(1)
    ))
    .returning()
  
  return row ? parseTask(row) : null
}

// Keep old name as alias for backward compatibility during transition
export const claimNextPendingTask = claimNextReadyTask

export async function resetStuckTasks(): Promise<number> {
  const result = await db.update(tasks)
    .set({
      status: TaskStatus.DRAFT,
      sessionId: null,
      startedAt: null,
      errorMessage: null,
      updatedAt: now(),
    } as Partial<Task>)
    .where(inArray(tasks.status, [TaskStatus.IN_PLANNING, TaskStatus.QUEUED, TaskStatus.RUNNING]))
    .returning()
  
  return result.length
}

export async function markTaskFailed(id: string, errorMessage: string): Promise<Task | null> {
  const [row] = await db.update(tasks)
    .set({
      status: TaskStatus.FAILED,
      errorMessage,
      completedAt: now(),
      updatedAt: now(),
    } as Partial<Task>)
    .where(eq(tasks.id, id))
    .returning()
  
  return row ? parseTask(row) : null
}

export async function updateTask(
  id: string,
  input: { title?: string; description?: string; priority?: number }
): Promise<Task | null> {
  const [row] = await db.update(tasks)
    .set({ ...input, updatedAt: now() })
    .where(eq(tasks.id, id))
    .returning()

  return row ? parseTask(row) : null
}

export async function updateTaskDiffPath(id: string, diffPath: string): Promise<Task | null> {
  const [row] = await db.update(tasks)
    .set({ diffPath, updatedAt: now() })
    .where(eq(tasks.id, id))
    .returning()
  
  return row ? parseTask(row) : null
}

export async function readPlanDoc(
  repoPath: string,
  planPath: string,
  file: string
): Promise<string | null> {
  // repoPath is already resolved (no ~) — stored as resolvedPath from project
  // planPath is the subfolder under .planning/ (e.g. "pcw-101-my-task")
  const fullPath = join(repoPath, ".planning", planPath, file)
  if (!existsSync(fullPath)) return null
  try {
    return await readFile(fullPath, "utf-8")
  } catch {
    return null
  }
}

export async function listExecutablePlanDocs(repoPath: string, planPath: string): Promise<string[]> {
  if (!planPath) return []

  const planningRoot = join(repoPath, ".planning")
  const fullPath = join(planningRoot, planPath)
  if (!existsSync(fullPath)) return []

  try {
    if (statSync(fullPath).isFile()) {
      const fileName = planPath.split("/").pop() || ""
      return fileName.endsWith("PLAN.md") || fileName === "EXECUTION.md" ? [planPath] : []
    }

    const results: string[] = []
    const walk = async (dir: string, base: string): Promise<void> => {
      const entries = await readdir(dir, { withFileTypes: true })
      for (const entry of entries) {
        const rel = base ? `${base}/${entry.name}` : entry.name
        if (entry.isDirectory()) await walk(join(dir, entry.name), rel)
        else if (entry.name.endsWith("PLAN.md") || entry.name === "EXECUTION.md") results.push(rel)
      }
    }

    await walk(fullPath, "")
    return results.sort((a, b) => a.localeCompare(b))
  } catch {
    return []
  }
}

export async function hasExecutablePlan(repoPath: string, planPath: string | null | undefined): Promise<boolean> {
  if (!planPath) return false
  const docs = await listExecutablePlanDocs(repoPath, planPath)
  return docs.length > 0
}

export interface ValidationResult {
  /** Whether the codebase shows signs that work was completed */
  likelyComplete: boolean
  /** Recent commits in the repo since the task was started (or last 24h if no startedAt) */
  recentCommits: Array<{ hash: string; message: string; date: string; author: string }>
  /** Files mentioned in plan docs that exist in the repo */
  planFilesFound: string[]
  /** Files mentioned in plan docs that are missing from the repo */
  planFilesMissing: string[]
  /** Files modified by recent commits */
  recentlyChangedFiles: string[]
  /** Plan files (BRIEF.md, ROADMAP.md, phase plans) found in .planning/ */
  planDocsFound: string[]
  /** Human-readable summary */
  summary: string
}

/**
 * Validate whether work for a task appears to have been completed in the repo.
 * Uses git log and filesystem checks — no AI involved, fast and reliable.
 */
export async function validateTask(id: string): Promise<ValidationResult | null> {
  const task = await getTask(id)
  if (!task) return null

  const repoPath = task.repoPath
  const since = task.startedAt ?? new Date(Date.now() - 24 * 60 * 60 * 1000).toISOString()

  // 1. Recent git commits since task started
  let recentCommits: ValidationResult["recentCommits"] = []
  let recentlyChangedFiles: string[] = []
  try {
    const logOutput = execSync(
      `git log --since="${since}" --format="%H|%s|%ai|%an" --no-merges`,
      { cwd: repoPath, encoding: "utf-8", timeout: 10_000 }
    ).trim()
    if (logOutput) {
      recentCommits = logOutput.split("\n").map((line) => {
        const [hash, message, date, author] = line.split("|")
        return { hash: hash.slice(0, 8), message, date, author }
      })
    }

    // Files changed in those commits
    if (recentCommits.length > 0) {
      const diffOutput = execSync(
        `git diff --name-only HEAD~${Math.min(recentCommits.length, 10)} HEAD 2>/dev/null || git diff --name-only HEAD`,
        { cwd: repoPath, encoding: "utf-8", timeout: 10_000 }
      ).trim()
      recentlyChangedFiles = diffOutput ? diffOutput.split("\n").filter(Boolean) : []
    }
  } catch {
    // Not a git repo or git not available — continue with other checks
  }

  // 2. Extract file paths mentioned in plan docs
  const mentionedFiles: string[] = []
  if (task.planPath) {
    const planContent = [
      await readPlanDoc(task.repoPath, task.planPath, "BRIEF.md"),
      await readPlanDoc(task.repoPath, task.planPath, "ROADMAP.md"),
    ].filter(Boolean).join("\n")

    // Match paths that look like source files: src/foo/bar.ts, packages/x/y.ts, etc.
    const filePattern = /\b([\w.-]+\/[\w./-]+\.\w{1,6})\b/g
    const matches = [...planContent.matchAll(filePattern)].map((m) => m[1])
    mentionedFiles.push(...[...new Set(matches)])
  }

  // Also include targetFiles from the task
  mentionedFiles.push(...(task.targetFiles ?? []))

  const uniqueFiles = [...new Set(mentionedFiles)]
  const planFilesFound = uniqueFiles.filter((f) => existsSync(join(repoPath, f)))
  const planFilesMissing = uniqueFiles.filter((f) => !existsSync(join(repoPath, f)))

  // 3. List plan docs in .planning/
  const planDocsFound: string[] = []
  if (task.planPath) {
    const planDir = join(repoPath, ".planning", task.planPath)
    try {
      const walk = async (dir: string, base: string): Promise<void> => {
        const entries = await readdir(dir, { withFileTypes: true })
        for (const e of entries) {
          if (e.isDirectory()) await walk(join(dir, e.name), `${base}${e.name}/`)
          else planDocsFound.push(`${base}${e.name}`)
        }
      }
      await walk(planDir, "")
    } catch { /* planPath doesn't exist yet */ }
  }

  // 4. Determine likely completion
  const hasCommits = recentCommits.length > 0
  const hasPlanDocs = planDocsFound.some((f) => f.endsWith("BRIEF.md") || f.endsWith("ROADMAP.md") || f.endsWith("EXECUTION.md") || f.includes("PLAN.md"))
  const likelyComplete = hasCommits || hasPlanDocs

  // 5. Summary
  const parts: string[] = []
  if (recentCommits.length > 0) {
    parts.push(`${recentCommits.length} commit${recentCommits.length > 1 ? "s" : ""} found since task started`)
  } else {
    parts.push("No commits found since task started")
  }
  if (hasPlanDocs) {
    parts.push(`${planDocsFound.length} plan doc${planDocsFound.length > 1 ? "s" : ""} found in .planning/`)
  }
  if (planFilesFound.length > 0) {
    parts.push(`${planFilesFound.length} referenced file${planFilesFound.length > 1 ? "s" : ""} exist in repo`)
  }
  if (planFilesMissing.length > 0) {
    parts.push(`${planFilesMissing.length} referenced file${planFilesMissing.length > 1 ? "s" : ""} not yet created`)
  }

  return {
    likelyComplete,
    recentCommits,
    planFilesFound,
    planFilesMissing,
    recentlyChangedFiles,
    planDocsFound,
    summary: parts.join(" · "),
  }
}
