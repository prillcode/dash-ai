import { sqliteTable, text, integer, index } from "drizzle-orm/sqlite-core"

export const PersonaType = {
  PLANNER: "planner",
  CODER: "coder",
  REVIEWER: "reviewer",
  CUSTOM: "custom",
} as const

export type PersonaTypeValue = typeof PersonaType[keyof typeof PersonaType]

export const personas = sqliteTable("personas", {
  id: text("id").primaryKey(),
  name: text("name").notNull(),
  description: text("description").notNull().default(""),
  personaType: text("persona_type").notNull().default("custom"),
  systemPrompt: text("system_prompt").notNull(),
  model: text("model").notNull().default("claude-sonnet-4-5"),
  provider: text("provider").notNull().default("anthropic"),
  allowedTools: text("allowed_tools").notNull().default("[]"),
  contextFiles: text("context_files").notNull().default("[]"),
  tags: text("tags").notNull().default("[]"),
  isActive: integer("is_active", { mode: "boolean" }).notNull().default(true),
  createdAt: text("created_at").notNull(),
  updatedAt: text("updated_at").notNull(),
}, (table) => ({
  isActiveIdx: index("idx_personas_is_active").on(table.isActive),
  createdAtIdx: index("idx_personas_created_at").on(table.createdAt),
}))

export const projects = sqliteTable("projects", {
  id: text("id").primaryKey(),
  name: text("name").notNull(),
  description: text("description").notNull().default(""),
  path: text("path").notNull(),
  isActive: integer("is_active", { mode: "boolean" }).notNull().default(true),
  createdAt: text("created_at").notNull(),
  updatedAt: text("updated_at").notNull(),
}, (table) => ({
  isActiveIdx: index("idx_projects_is_active").on(table.isActive),
  createdAtIdx: index("idx_projects_created_at").on(table.createdAt),
}))


export const tasks = sqliteTable("tasks", {
  id: text("id").primaryKey(),
  identifier: text("identifier"),
  title: text("title").notNull(),
  description: text("description").notNull(),
  codingPersonaId: text("coding_persona_id").notNull().references(() => personas.id),
  codingPersonaName: text("coding_persona_name").notNull(),
  planningPersonaId: text("planning_persona_id").references(() => personas.id),
  planningPersonaName: text("planning_persona_name"),
  status: text("status").notNull().default("DRAFT"),
  priority: integer("priority").notNull().default(3),
  repoPath: text("repo_path").notNull(),
  projectId: text("project_id").references(() => projects.id),
  targetFiles: text("target_files").notNull().default("[]"),
  planFeedback: text("plan_feedback"),
  codingFeedback: text("coding_feedback"),
  planPath: text("plan_path"),
  sessionId: text("session_id"),
  outputLog: text("output_log"),
  diffPath: text("diff_path"),
  errorMessage: text("error_message"),
  reviewedBy: text("reviewed_by"),
  reviewNote: text("review_note"),
  startedAt: text("started_at"),
  completedAt: text("completed_at"),
  createdAt: text("created_at").notNull(),
  updatedAt: text("updated_at").notNull(),
}, (table) => ({
  statusIdx: index("idx_tasks_status").on(table.status),
  codingPersonaIdIdx: index("idx_tasks_coding_persona_id").on(table.codingPersonaId),
  planningPersonaIdIdx: index("idx_tasks_planning_persona_id").on(table.planningPersonaId),
  createdAtIdx: index("idx_tasks_created_at").on(table.createdAt),
  statusCreatedAtIdx: index("idx_tasks_status_created_at").on(table.status, table.createdAt),
  priorityCreatedAtIdx: index("idx_tasks_priority_created_at").on(table.priority, table.createdAt),
}))

export const taskEvents = sqliteTable("task_events", {
  id: text("id").primaryKey(),
  taskId: text("task_id").notNull().references(() => tasks.id),
  eventType: text("event_type").notNull(),
  payload: text("payload").notNull().default("{}"),
  createdAt: text("created_at").notNull(),
}, (table) => ({
  taskIdIdx: index("idx_task_events_task_id").on(table.taskId),
  taskIdCreatedAtIdx: index("idx_task_events_task_id_created_at").on(table.taskId, table.createdAt),
}))

export const settings = sqliteTable("settings", {
  id: text("id").primaryKey(),
  key: text("key").notNull().unique(),
  value: text("value").notNull(),
  updatedAt: text("updated_at").notNull(),
}, (table) => ({
  keyIdx: index("idx_settings_key").on(table.key),
}))

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
