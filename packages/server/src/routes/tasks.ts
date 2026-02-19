import { Hono } from "hono"
import { z } from "zod"
import { readFileSync, existsSync } from "fs"
import * as taskService from "../services/taskService"
import * as personaService from "../services/personaService"
import * as eventService from "../services/eventService"
import { TaskStatus } from "../db/schema"

export const tasksRouter = new Hono()

const taskSchema = z.object({
  title: z.string().min(1),
  description: z.string().min(1),
  personaId: z.string().min(1),
  repoPath: z.string().min(1),
  targetFiles: z.array(z.string()).optional(),
  priority: z.number().min(1).max(5).optional(),
})

const statusUpdateSchema = z.object({
  status: z.enum([
    TaskStatus.APPROVED,
    TaskStatus.REJECTED,
    TaskStatus.PENDING,
    TaskStatus.FAILED,
  ]),
  reviewedBy: z.string().optional(),
  reviewNote: z.string().optional(),
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
  
  const persona = await personaService.getPersona(parsed.data.personaId)
  if (!persona) {
    return c.json({ error: "Persona not found" }, 400)
  }
  
  const task = await taskService.createTask({
    ...parsed.data,
    personaName: persona.name,
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
  
  await eventService.appendEvent(id, "REVIEW_ACTION", {
    action: parsed.data.status as "APPROVED" | "REJECTED",
    reviewedBy: parsed.data.reviewedBy || "unknown",
    note: parsed.data.reviewNote,
  })
  
  return c.json(task)
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
