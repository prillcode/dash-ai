export const TaskStatus = {
  PENDING: "PENDING",
  QUEUED: "QUEUED",
  RUNNING: "RUNNING",
  AWAITING_REVIEW: "AWAITING_REVIEW",
  APPROVED: "APPROVED",
  REJECTED: "REJECTED",
  COMPLETE: "COMPLETE",
  FAILED: "FAILED",
} as const

export type TaskStatusType = typeof TaskStatus[keyof typeof TaskStatus]

export interface Task {
  id: string
  title: string
  description: string
  personaId: string
  personaName: string
  status: TaskStatusType
  priority: number
  repoPath: string
  targetFiles: string[]
  sessionId: string | null
  outputLog: string | null
  diffPath: string | null
  errorMessage: string | null
  reviewedBy: string | null
  reviewNote: string | null
  startedAt: string | null
  completedAt: string | null
  createdAt: string
  updatedAt: string
}

export interface TaskInput {
  title: string
  description: string
  personaId: string
  repoPath: string
  targetFiles?: string[]
  priority?: number
}

export interface TaskFilters {
  status?: string
  personaId?: string
  priority?: number
}

export interface TaskEvent {
  id: string
  taskId: string
  eventType: "STATUS_CHANGE" | "TOOL_CALL" | "AGENT_OUTPUT" | "ERROR" | "REVIEW_ACTION"
  payload: unknown
  createdAt: string
}

export interface StatusChangePayload {
  from: string
  to: string
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
