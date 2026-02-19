import { eq, desc, asc, and, inArray } from "drizzle-orm"
import { db } from "../db/client"
import { tasks, TaskStatus } from "../db/schema"
import { generateId } from "../utils/id"
import { now } from "../utils/time"

type Task = typeof tasks.$inferSelect
type NewTask = typeof tasks.$inferInsert

export interface TaskInput {
  title: string
  description: string
  personaId: string
  personaName: string
  repoPath: string
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
    conditions.push(eq(tasks.personaId, filters.personaId))
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
  const id = generateId()
  const timestamp = now()
  const serialized = serializeTask(input)
  
  const [row] = await db.insert(tasks).values({
    id,
    title: input.title,
    description: input.description,
    personaId: input.personaId,
    personaName: input.personaName,
    status: TaskStatus.PENDING,
    priority: input.priority ?? 3,
    repoPath: input.repoPath,
    targetFiles: serialized.targetFiles,
    createdAt: timestamp,
    updatedAt: timestamp,
  } as NewTask).returning()
  
  return parseTask(row)
}

export async function updateTaskStatus(
  id: string,
  status: string,
  extra?: Partial<Pick<Task, "diffPath" | "outputLog" | "sessionId" | "errorMessage" | "reviewedBy" | "reviewNote" | "startedAt" | "completedAt">>
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

export async function claimNextPendingTask(): Promise<Task | null> {
  const [row] = await db.update(tasks)
    .set({ status: TaskStatus.QUEUED, updatedAt: now() })
    .where(eq(tasks.id, db
      .select({ id: tasks.id })
      .from(tasks)
      .where(eq(tasks.status, TaskStatus.PENDING))
      .orderBy(asc(tasks.priority), asc(tasks.createdAt))
      .limit(1)
    ))
    .returning()
  
  return row ? parseTask(row) : null
}

export async function resetStuckTasks(): Promise<number> {
  const result = await db.update(tasks)
    .set({ status: TaskStatus.PENDING, updatedAt: now() })
    .where(inArray(tasks.status, [TaskStatus.QUEUED, TaskStatus.RUNNING]))
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
