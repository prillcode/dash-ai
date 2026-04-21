import { Hono } from "hono"
import { z } from "zod"
import * as projectService from "../services/projectService"
import * as agentMdService from "../services/agentMdService"

export const projectsRouter = new Hono()

const projectSchema = z.object({
  name: z.string().min(1),
  description: z.string().optional(),
  path: z.string().min(1),
})

const projectUpdateSchema = projectSchema.partial()
const generateAgentMdSchema = z.object({
  overwrite: z.boolean().optional(),
})

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

projectsRouter.get("/:id/agent-md", async (c) => {
  try {
    const snapshot = await agentMdService.getAgentMd(c.req.param("id"))
    return c.json(snapshot)
  } catch (err) {
    return c.json({ error: err instanceof Error ? err.message : "Failed to load Agent.md" }, 404)
  }
})

projectsRouter.post("/:id/generate-agent-md", async (c) => {
  const body = await c.req.json().catch(() => ({}))
  const parsed = generateAgentMdSchema.safeParse(body)

  if (!parsed.success) {
    return c.json({ error: "Validation failed", details: parsed.error.issues }, 400)
  }

  try {
    const result = await agentMdService.generateAgentMd(c.req.param("id"), parsed.data)
    return c.json(result, 201)
  } catch (err) {
    if (err instanceof agentMdService.AgentMdOverwriteRequiredError) {
      return c.json({
        error: err.message,
        overwriteRequired: true,
        path: err.filePath,
      }, 409)
    }
    if (err instanceof agentMdService.AgentMdGenerationError) {
      console.error("Agent.md generation failed", err.diagnostics)
      return c.json({
        error: err.message,
        diagnostics: err.diagnostics,
      }, 400)
    }
    return c.json({ error: err instanceof Error ? err.message : "Failed to generate Agent.md" }, 400)
  }
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