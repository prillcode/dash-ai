import { Hono } from "hono"
import { z } from "zod"
import * as personaService from "../services/personaService"

export const personasRouter = new Hono()

const personaSchema = z.object({
  name: z.string().min(1),
  description: z.string().optional(),
  personaType: z.string().optional(),
  systemPrompt: z.string().min(1),
  model: z.string().optional(),
  provider: z.string().optional(),
  allowedTools: z.array(z.string()).optional(),
  contextFiles: z.array(z.string()).optional(),
  tags: z.array(z.string()).optional(),
})

const personaUpdateSchema = personaSchema.partial()

personasRouter.get("/", async (c) => {
  const activeOnly = c.req.query("activeOnly") !== "false"
  const personas = await personaService.listPersonas(activeOnly)
  return c.json(personas)
})

personasRouter.post("/", async (c) => {
  const body = await c.req.json()
  const parsed = personaSchema.safeParse(body)
  
  if (!parsed.success) {
    return c.json({ error: "Validation failed", details: parsed.error.issues }, 400)
  }
  
  const persona = await personaService.createPersona(parsed.data)
  return c.json(persona, 201)
})

personasRouter.get("/:id", async (c) => {
  const id = c.req.param("id")
  console.log('GET /api/personas/:id', id)
  const persona = await personaService.getPersona(id)
  
  if (!persona) {
    return c.json({ error: "Persona not found" }, 404)
  }
  
  console.log('Returning persona:', persona.personaType, persona.provider, persona.model)
  return c.json(persona)
})

personasRouter.put("/:id", async (c) => {
  const id = c.req.param("id")
  const body = await c.req.json()
  console.log('PUT /api/personas/:id body:', body)
  const parsed = personaUpdateSchema.safeParse(body)
  
  if (!parsed.success) {
    console.log('Validation failed:', parsed.error.issues)
    return c.json({ error: "Validation failed", details: parsed.error.issues }, 400)
  }
  
  console.log('Parsed data:', parsed.data)
  const persona = await personaService.updatePersona(id, parsed.data)
  
  if (!persona) {
    return c.json({ error: "Persona not found" }, 404)
  }
  
  return c.json(persona)
})

personasRouter.patch("/:id/toggle", async (c) => {
  const id = c.req.param("id")
  const persona = await personaService.togglePersonaActive(id)
  
  if (!persona) {
    return c.json({ error: "Persona not found" }, 404)
  }
  
  return c.json(persona)
})

personasRouter.delete("/:id", async (c) => {
  const id = c.req.param("id")
  const deleted = await personaService.deletePersona(id)
  
  if (!deleted) {
    return c.json({ error: "Persona not found" }, 404)
  }
  
  return c.json({ success: true })
})
