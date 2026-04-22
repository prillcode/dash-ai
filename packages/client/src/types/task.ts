export const TaskStatus = {
  DRAFT: "DRAFT",
  IN_PLANNING: "IN_PLANNING",
  PLANNED: "PLANNED",
  READY_TO_CODE: "READY_TO_CODE",
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
  identifier: string | null
  title: string
  description: string
  codingPersonaId: string
  codingPersonaName: string
  planningPersonaId: string | null
  planningPersonaName: string | null
  status: TaskStatusType
  priority: number
  projectId: string
  repoPath: string
  targetFiles: string[]
  planFeedback: string | null
  codingFeedback: string | null
  planPath: string | null
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
  identifier?: string
  title: string
  description: string
  codingPersonaId: string
  planningPersonaId?: string
  projectId: string
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
  eventType:
    | "STATUS_CHANGE"
    | "TOOL_CALL"
    | "TOOL_START"
    | "TOOL_END"
    | "AGENT_OUTPUT"
    | "ERROR"
    | "REVIEW_ACTION"
    | "PLANNING_EVENT"
    | "CODING_EVENT"
    | "AGENT_QUESTION"
    | "PLAN_FEEDBACK"
    | "CODING_FEEDBACK"
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
