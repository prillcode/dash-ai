import { eq, asc } from "drizzle-orm"
import { db } from "../db/client"
import { taskEvents } from "../db/schema"
import { generateId } from "../utils/id"
import { now } from "../utils/time"
import { broadcast } from "../ws/taskStream"

type TaskEvent = typeof taskEvents.$inferSelect

export interface StatusChangePayload {
  from: string
  to: string
  message?: string
}

export interface ToolCallPayload {
  tool: string
  input: string
  output: string
  durationMs: number
  success: boolean
}

export interface AgentOutputPayload {
  text: string
}

export interface ErrorPayload {
  message: string
  stack?: string
}

export interface ReviewActionPayload {
  action: "APPROVED" | "REJECTED"
  reviewedBy: string
  note?: string
}

export type PlanningEventPayload = Record<string, unknown>

export type CodingEventPayload = Record<string, unknown>

export interface PlanFeedbackPayload {
  feedback: string
}

export type EventPayload =
  | StatusChangePayload
  | ToolCallPayload
  | AgentOutputPayload
  | ErrorPayload
  | ReviewActionPayload
  | PlanningEventPayload
  | CodingEventPayload
  | PlanFeedbackPayload

export type EventType =
  | "STATUS_CHANGE"
  | "TOOL_CALL"
  | "AGENT_OUTPUT"
  | "ERROR"
  | "REVIEW_ACTION"
  | "REVIEW_GENERATED"
  | "PLANNING_EVENT"
  | "CODING_EVENT"
  | "PLAN_FEEDBACK"

function parseEvent(row: TaskEvent) {
  return {
    ...row,
    payload: JSON.parse(row.payload),
  }
}

export async function listTaskEvents(taskId: string): Promise<TaskEvent[]> {
  const result = await db.select()
    .from(taskEvents)
    .where(eq(taskEvents.taskId, taskId))
    .orderBy(asc(taskEvents.createdAt))
  
  return result.map(parseEvent)
}

export async function appendEvent(
  taskId: string,
  eventType: EventType,
  payload: EventPayload
): Promise<TaskEvent> {
  const id = generateId()
  const timestamp = now()
  
  const [row] = await db.insert(taskEvents).values({
    id,
    taskId,
    eventType,
    payload: JSON.stringify(payload),
    createdAt: timestamp,
  } as typeof taskEvents.$inferInsert).returning()
  
  const parsed = parseEvent(row)
  
  broadcast(taskId, parsed)
  
  return parsed
}
