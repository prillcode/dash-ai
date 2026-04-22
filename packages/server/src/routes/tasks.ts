import { Hono } from "hono"
import { z } from "zod"
import { readFileSync, existsSync } from "fs"
import * as taskService from "../services/taskService"
import * as personaService from "../services/personaService"
import * as projectService from "../services/projectService"
import * as eventService from "../services/eventService"
import { TaskStatus } from "../db/schema"

export const tasksRouter = new Hono()

const taskSchema = z.object({
  identifier: z.string().optional(),
  title: z.string().min(1),
  description: z.string().min(1),
  codingPersonaId: z.string().min(1),
  planningPersonaId: z.string().optional(),
  projectId: z.string().min(1),
  targetFiles: z.array(z.string()).optional(),
  priority: z.number().min(1).max(5).optional(),
})

const statusUpdateSchema = z.object({
  status: z.enum([
    TaskStatus.DRAFT,
    TaskStatus.PLANNED,
    TaskStatus.READY_TO_CODE,
    TaskStatus.APPROVED,
    TaskStatus.REJECTED,
    TaskStatus.FAILED,
    TaskStatus.COMPLETE,
  ]),
  reviewedBy: z.string().optional(),
  reviewNote: z.string().optional(),
})

const taskUpdateSchema = z.object({
  title: z.string().min(1).optional(),
  description: z.string().min(1).optional(),
  priority: z.number().min(1).max(5).optional(),
})

const iteratePlanSchema = z.object({
  feedback: z.string().min(1),
})

const iterateCodingSchema = z.object({
  feedback: z.string().min(1),
})

tasksRouter.get("/", async (c) => {
  const filters = {
    status: c.req.query("status"),
    personaId: c.req.query("personaId"),
    priority: c.req.query("priority") ? parseInt(c.req.query("priority")!) : undefined,
  }
  
  const tasks = await taskService.listTasks(filters)
  return c.json(tasks)
})

tasksRouter.post("/", async (c) => {
  const body = await c.req.json()
  const parsed = taskSchema.safeParse(body)
  
  if (!parsed.success) {
    return c.json({ error: "Validation failed", details: parsed.error.issues }, 400)
  }
  
  const codingPersona = await personaService.getPersona(parsed.data.codingPersonaId)
  if (!codingPersona) {
    return c.json({ error: "Coding persona not found" }, 400)
  }

  let planningPersonaName: string | undefined
  if (parsed.data.planningPersonaId) {
    const planningPersona = await personaService.getPersona(parsed.data.planningPersonaId)
    if (!planningPersona) {
      return c.json({ error: "Planning persona not found" }, 400)
    }
    planningPersonaName = planningPersona.name
  }
  
  const project = await projectService.getProject(parsed.data.projectId)
  if (!project) {
    return c.json({ error: "Project not found" }, 400)
  }

  const task = await taskService.createTask({
    ...parsed.data,
    codingPersonaName: codingPersona.name,
    planningPersonaName,
  })
  
  return c.json(task, 201)
})

tasksRouter.get("/:id", async (c) => {
  const id = c.req.param("id")
  const task = await taskService.getTask(id)
  
  if (!task) {
    return c.json({ error: "Task not found" }, 404)
  }
  
  return c.json(task)
})

tasksRouter.patch("/:id", async (c) => {
  const id = c.req.param("id")
  const body = await c.req.json()
  const parsed = taskUpdateSchema.safeParse(body)
  
  if (!parsed.success) {
    return c.json({ error: "Validation failed", details: parsed.error.issues }, 400)
  }
  
  const task = await taskService.updateTask(id, parsed.data)
  
  if (!task) {
    return c.json({ error: "Task not found" }, 404)
  }
  
  return c.json(task)
})

tasksRouter.patch("/:id/status", async (c) => {
  const id = c.req.param("id")
  const body = await c.req.json()
  const parsed = statusUpdateSchema.safeParse(body)
  
  if (!parsed.success) {
    return c.json({ error: "Validation failed", details: parsed.error.issues }, 400)
  }

  const existing = await taskService.getTask(id)
  if (!existing) {
    return c.json({ error: "Task not found" }, 404)
  }

  if (parsed.data.status === TaskStatus.READY_TO_CODE) {
    const hasExecutablePlan = await taskService.hasExecutablePlan(existing.repoPath, existing.planPath)
    if (!hasExecutablePlan) {
      return c.json({ error: "Task cannot be marked ready to code until an executable PLAN.md or EXECUTION.md exists in its plan directory" }, 400)
    }
  }

  if (parsed.data.status === TaskStatus.DRAFT && [TaskStatus.QUEUED, TaskStatus.RUNNING].includes(existing.status as any)) {
    return c.json({ error: "Use the cancel action for queued or running coding tasks" }, 400)
  }
  
  const task = await taskService.updateTaskStatus(id, parsed.data.status, {
    reviewedBy: parsed.data.reviewedBy,
    reviewNote: parsed.data.reviewNote,
  })
  
  if (!task) {
    return c.json({ error: "Task not found" }, 404)
  }
  
  await eventService.appendEvent(id, "STATUS_CHANGE", {
    from: existing.status,
    to: parsed.data.status,
  })
  
  return c.json(task)
})

tasksRouter.post("/:id/start-planning", async (c) => {
  const id = c.req.param("id")
  const task = await taskService.getTask(id)
  
  if (!task) {
    return c.json({ error: "Task not found" }, 404)
  }
  
  if (task.status !== TaskStatus.DRAFT) {
    return c.json({ error: "Only DRAFT tasks can start planning" }, 400)
  }
  
  if (!task.planningPersonaId) {
    return c.json({ error: "Task has no planning persona assigned" }, 400)
  }
  
  const updated = await taskService.updateTaskStatus(id, TaskStatus.IN_PLANNING)
  if (!updated) {
    return c.json({ error: "Failed to update task status" }, 500)
  }
  
  await eventService.appendEvent(id, "STATUS_CHANGE", {
    from: TaskStatus.DRAFT,
    to: TaskStatus.IN_PLANNING,
  })
  
  return c.json(updated)
})

tasksRouter.post("/:id/iterate-plan", async (c) => {
  const id = c.req.param("id")
  const body = await c.req.json()
  const parsed = iteratePlanSchema.safeParse(body)
  
  if (!parsed.success) {
    return c.json({ error: "Validation failed", details: parsed.error.issues }, 400)
  }
  
  const task = await taskService.getTask(id)
  if (!task) {
    return c.json({ error: "Task not found" }, 404)
  }
  
  if (task.status !== TaskStatus.PLANNED) {
    return c.json({ error: "Only PLANNED tasks can iterate plan" }, 400)
  }
  
  const updated = await taskService.updateTaskStatus(id, TaskStatus.IN_PLANNING, {
    planFeedback: parsed.data.feedback,
  })
  if (!updated) {
    return c.json({ error: "Failed to update task status" }, 500)
  }
  
  await eventService.appendEvent(id, "STATUS_CHANGE", {
    from: TaskStatus.PLANNED,
    to: TaskStatus.IN_PLANNING,
  })
  
  await eventService.appendEvent(id, "PLAN_FEEDBACK", {
    feedback: parsed.data.feedback,
  })
  
  return c.json(updated)
})

tasksRouter.post("/:id/queue-coding", async (c) => {
  const id = c.req.param("id")
  const task = await taskService.getTask(id)

  if (!task) {
    return c.json({ error: "Task not found" }, 404)
  }

  if (![TaskStatus.DRAFT, TaskStatus.READY_TO_CODE].includes(task.status as any)) {
    return c.json({ error: `Can only queue coding from DRAFT or READY_TO_CODE. Current: ${task.status}` }, 400)
  }

  const hasExecutablePlan = await taskService.hasExecutablePlan(task.repoPath, task.planPath)
  if (!hasExecutablePlan) {
    return c.json({ error: "Task cannot queue coding until an executable PLAN.md or EXECUTION.md exists in its plan directory" }, 400)
  }

  const updated = await taskService.updateTaskStatus(id, TaskStatus.QUEUED, {
    codingFeedback: null,
    sessionId: null,
    startedAt: null,
    completedAt: null,
    errorMessage: null,
    reviewedBy: null,
    reviewNote: null,
    outputLog: null,
    diffPath: null,
  })
  if (!updated) {
    return c.json({ error: "Failed to queue coding task" }, 500)
  }

  await eventService.appendEvent(id, "STATUS_CHANGE", {
    from: task.status,
    to: TaskStatus.QUEUED,
    message: "coding queued by user",
  })

  await eventService.appendEvent(id, "CODING_EVENT", {
    status: "queued",
    message: "Queued coding run",
  })

  return c.json(updated)
})

tasksRouter.post("/:id/iterate-coding", async (c) => {
  const id = c.req.param("id")
  const body = await c.req.json()
  const parsed = iterateCodingSchema.safeParse(body)

  if (!parsed.success) {
    return c.json({ error: "Validation failed", details: parsed.error.issues }, 400)
  }

  const task = await taskService.getTask(id)
  if (!task) {
    return c.json({ error: "Task not found" }, 404)
  }

  if (![TaskStatus.AWAITING_REVIEW, TaskStatus.FAILED].includes(task.status as any)) {
    return c.json({ error: `Can only iterate coding from AWAITING_REVIEW or FAILED. Current: ${task.status}` }, 400)
  }

  const hasExecutablePlan = await taskService.hasExecutablePlan(task.repoPath, task.planPath)
  if (!hasExecutablePlan) {
    return c.json({ error: "Task cannot iterate coding until an executable PLAN.md or EXECUTION.md exists in its plan directory" }, 400)
  }

  const updated = await taskService.updateTaskStatus(id, TaskStatus.QUEUED, {
    codingFeedback: parsed.data.feedback,
    sessionId: null,
    startedAt: null,
    completedAt: null,
    errorMessage: null,
    reviewedBy: null,
    reviewNote: null,
    outputLog: null,
    diffPath: null,
  })
  if (!updated) {
    return c.json({ error: "Failed to queue coding iteration" }, 500)
  }

  await eventService.appendEvent(id, "STATUS_CHANGE", {
    from: task.status,
    to: TaskStatus.QUEUED,
    message: "coding iteration queued by user",
  })

  await eventService.appendEvent(id, "CODING_FEEDBACK", {
    feedback: parsed.data.feedback,
    previousStatus: task.status,
  })

  await eventService.appendEvent(id, "CODING_EVENT", {
    status: "queued",
    message: "Queued coding follow-up run",
  })

  return c.json(updated)
})

const reviewSchema = z.object({
  personaId: z.string().optional(),
})

tasksRouter.post("/:id/review", async (c) => {
  const id = c.req.param("id")
  const task = await taskService.getTask(id)

  if (!task) {
    return c.json({ error: "Task not found" }, 404)
  }

  if (task.status !== TaskStatus.AWAITING_REVIEW) {
    return c.json({ error: `Can only review tasks in AWAITING_REVIEW status. Current: ${task.status}` }, 400)
  }

  // Fetch diff and brief in parallel
  const { readPlanDoc } = await import("../services/taskService")
  // Get diff directly from the stored diffPath
  let diffContent = ""
  if (task.diffPath) {
    try {
      const { readFileSync } = await import("fs")
      diffContent = readFileSync(task.diffPath, "utf-8")
    } catch {
      diffContent = ""
    }
  }

  let briefContent = ""
  let planPath = task.planPath

  // Try to read BRIEF.md from the plan directory
  const planPathVal = task.planPath
  if (planPathVal) {
    const projectId = task.projectId as string
    const project = await projectService.getProject(projectId)
    if (project) {
      const brief = await readPlanDoc(project.resolvedPath as string, planPathVal as string, "BRIEF.md")
      briefContent = brief ?? ""
    }
  }

  // Use reviewer persona or default
  const body = await c.req.json().catch(() => ({}))
  const personaId = body.personaId ?? task.codingPersonaId

  const reviewerPersona = await personaService.getPersona(personaId)

  // For now, produce a static analysis from the diff
  // (Full Pi SDK reviewer session to be added in DA-01 Phase 03)
  const diffStr = diffContent
  const filesChanged = (diffStr.match(/^\+\+\+ /m) ?? []).length
  const linesAdded = (diffStr.match(/^\+[^+]/m) ?? []).length
  const linesRemoved = (diffStr.match(/^-[^-]/m) ?? []).length

  const concerns: string[] = []
  if (linesAdded > 300) concerns.push("Large diff — consider splitting into smaller tasks")
  if (!diffStr.includes("test")) concerns.push("No test files modified")
  if (diffStr.includes("console.log")) concerns.push("Debug console.log statements present")

  const review = {
    summary: `Review of task '${task.title}': ${filesChanged} file(s) changed, ${linesAdded} line(s) added, ${linesRemoved} line(s) removed.`,
    filesChanged,
    linesAdded,
    linesRemoved,
    matchesPlan: true,
    concerns,
  }

  await eventService.appendEvent(id, "REVIEW_GENERATED", { reviewerPersona: reviewerPersona?.name ?? "default" })

  return c.json({ taskId: id, review })
})

tasksRouter.post("/:id/cancel", async (c) => {
  const id = c.req.param("id")
  const task = await taskService.getTask(id)

  if (!task) {
    return c.json({ error: "Task not found" }, 404)
  }

  if (![TaskStatus.QUEUED, TaskStatus.RUNNING].includes(task.status as any)) {
    return c.json({ error: "Only QUEUED or RUNNING tasks can be canceled" }, 400)
  }

  const { cancelCodingSession } = await import("../agent/sessionRegistry")
  const wasAborted = task.status === TaskStatus.RUNNING ? cancelCodingSession(id) : false

  const updated = await taskService.updateTaskStatus(id, TaskStatus.READY_TO_CODE, {
    sessionId: null,
    startedAt: null,
    completedAt: null,
    errorMessage: null,
  })
  if (!updated) {
    return c.json({ error: "Failed to cancel task" }, 500)
  }

  await eventService.appendEvent(id, "STATUS_CHANGE", {
    from: task.status,
    to: TaskStatus.READY_TO_CODE,
    message: wasAborted ? "coding session canceled by user" : "queued task canceled by user",
  })

  await eventService.appendEvent(id, "CODING_EVENT", {
    status: "canceled",
    message: wasAborted ? "Canceled active coding session" : "Canceled queued coding task",
  })

  return c.json(updated)
})

tasksRouter.post("/:id/retry", async (c) => {
  const id = c.req.param("id")
  const task = await taskService.getTask(id)

  if (!task) {
    return c.json({ error: "Task not found" }, 404)
  }

  if (task.status !== TaskStatus.FAILED) {
    return c.json({ error: "Only FAILED tasks can be retried" }, 400)
  }

  const updated = await taskService.updateTaskStatus(id, TaskStatus.DRAFT, {
    errorMessage: null,
    sessionId: null,
    diffPath: null,
    startedAt: null,
    completedAt: null,
  })
  if (!updated) {
    return c.json({ error: "Failed to reset task status" }, 500)
  }

  await eventService.appendEvent(id, "STATUS_CHANGE", {
    from: TaskStatus.FAILED,
    to: TaskStatus.DRAFT,
    reason: "retried by user",
  })

  return c.json(updated)
})

tasksRouter.get("/:id/diff", async (c) => {
  const id = c.req.param("id")
  const task = await taskService.getTask(id)
  
  if (!task) {
    return c.json({ error: "Task not found" }, 404)
  }
  
  if (!task.diffPath) {
    return c.json({ error: "No diff available for this task" }, 404)
  }
  
  if (!existsSync(task.diffPath)) {
    return c.json({ error: "Diff file not found on disk" }, 404)
  }
  
  try {
    const content = readFileSync(task.diffPath, "utf-8")
    return c.text(content)
  } catch {
    return c.json({ error: "Failed to read diff file" }, 500)
  }
})

tasksRouter.get("/:id/plan-doc", async (c) => {
  const id = c.req.param("id")
  const file = c.req.query("file")

  // Validate file param — only allow specific safe filenames
  const allowedFiles = ["BRIEF.md", "ROADMAP.md", "EXECUTION.md", "ISSUES.md"]
  if (!file || !allowedFiles.includes(file)) {
    return c.json({ error: "Invalid file param. Allowed: BRIEF.md, ROADMAP.md, EXECUTION.md, ISSUES.md" }, 400)
  }

  const task = await taskService.getTask(id)
  if (!task) return c.json({ error: "Task not found" }, 404)

  if (!task.repoPath || !task.planPath) {
    return c.json({ error: "Task has no plan path set" }, 404)
  }

  const content = await taskService.readPlanDoc(task.repoPath, task.planPath, file)
  if (content === null) {
    return c.json({ error: `${file} not found in plan directory` }, 404)
  }

  return c.json({ file, content })
})

tasksRouter.post("/:id/validate", async (c) => {
  const id = c.req.param("id")
  const result = await taskService.validateTask(id)
  if (!result) return c.json({ error: "Task not found" }, 404)
  return c.json(result)
})
