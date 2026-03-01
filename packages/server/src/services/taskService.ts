import { eq, desc, asc, and, inArray, isNull } from "drizzle-orm"
import { db } from "../db/client"
import * as projectService from "./projectService"
import { tasks, TaskStatus } from "../db/schema"
import { generateId } from "../utils/id"
import { now } from "../utils/time"
import { readFile } from "fs/promises"
import { existsSync } from "fs"
import { join } from "path"

type Task = typeof tasks.$inferSelect
type NewTask = typeof tasks.$inferInsert

export interface TaskInput {
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
    .set({ status: TaskStatus.DRAFT, updatedAt: now() })
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
