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

const iteratePlanSchema = z.object({
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

tasksRouter.patch("/:id/status", async (c) => {
  const id = c.req.param("id")
  const body = await c.req.json()
  const parsed = statusUpdateSchema.safeParse(body)
  
  if (!parsed.success) {
    return c.json({ error: "Validation failed", details: parsed.error.issues }, 400)
  }
  
  const task = await taskService.updateTaskStatus(id, parsed.data.status, {
    reviewedBy: parsed.data.reviewedBy,
    reviewNote: parsed.data.reviewNote,
  })
  
  if (!task) {
    return c.json({ error: "Task not found" }, 404)
  }
  
  await eventService.appendEvent(id, "STATUS_CHANGE", {
    from: "manual",
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
  const allowedFiles = ["BRIEF.md", "ROADMAP.md", "ISSUES.md"]
  if (!file || !allowedFiles.includes(file)) {
    return c.json({ error: "Invalid file param. Allowed: BRIEF.md, ROADMAP.md, ISSUES.md" }, 400)
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
