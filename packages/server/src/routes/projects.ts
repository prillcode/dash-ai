import { Hono } from "hono"
import { z } from "zod"
import * as projectService from "../services/projectService"

export const projectsRouter = new Hono()

const projectSchema = z.object({
  name: z.string().min(1),
  description: z.string().optional(),
  path: z.string().min(1),
})

const projectUpdateSchema = projectSchema.partial()

projectsRouter.get("/", async (c) => {
  const activeOnly = c.req.query("activeOnly") !== "false"
  const projects = await projectService.listProjects(activeOnly)
  return c.json(projects)
})

projectsRouter.post("/", async (c) => {
  const body = await c.req.json()
  const parsed = projectSchema.safeParse(body)
  
  if (!parsed.success) {
    return c.json({ error: "Validation failed", details: parsed.error.issues }, 400)
  }
  
  try {
    const project = await projectService.createProject(parsed.data)
    return c.json(project, 201)
  } catch (err) {
    return c.json({ error: err instanceof Error ? err.message : "Failed to create project" }, 400)
  }
})

projectsRouter.get("/validate-path", async (c) => {
  const path = c.req.query("path")
  if (!path) {
    return c.json({ error: "Missing path query parameter" }, 400)
  }
  
  const validation = projectService.validateProjectPath(path)
  return c.json(validation)
})

projectsRouter.get("/:id", async (c) => {
  const id = c.req.param("id")
  const project = await projectService.getProject(id)
  
  if (!project) {
    return c.json({ error: "Project not found" }, 404)
  }
  
  return c.json(project)
})

projectsRouter.patch("/:id", async (c) => {
  const id = c.req.param("id")
  const body = await c.req.json()
  const parsed = projectUpdateSchema.safeParse(body)
  
  if (!parsed.success) {
    return c.json({ error: "Validation failed", details: parsed.error.issues }, 400)
  }
  
  try {
    const project = await projectService.updateProject(id, parsed.data)
    
    if (!project) {
      return c.json({ error: "Project not found" }, 404)
    }
    
    return c.json(project)
  } catch (err) {
    return c.json({ error: err instanceof Error ? err.message : "Failed to update project" }, 400)
  }
})

projectsRouter.delete("/:id", async (c) => {
  const id = c.req.param("id")
  const deleted = await projectService.deleteProject(id)
  
  if (!deleted) {
    return c.json({ error: "Project not found" }, 404)
  }
  
  return c.json({ success: true })
})