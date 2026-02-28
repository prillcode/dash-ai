import { eq, desc } from "drizzle-orm"
import { db } from "../db/client"
import { personas } from "../db/schema"
import { generateId } from "../utils/id"
import { now } from "../utils/time"

type PersonaRow = typeof personas.$inferSelect
type NewPersona = typeof personas.$inferInsert

export interface ParsedPersona {
  id: string
  name: string
  description: string
  personaType: string
  systemPrompt: string
  model: string
  provider: string
  allowedTools: string[]
  contextFiles: string[]
  tags: string[]
  isActive: boolean
  createdAt: string
  updatedAt: string
}

export interface PersonaInput {
  name: string
  description?: string
  personaType?: string
  systemPrompt: string
  model?: string
  provider?: string
  allowedTools?: string[]
  contextFiles?: string[]
  tags?: string[]
}

function parsePersona(row: PersonaRow): ParsedPersona {
  return {
    ...row,
    allowedTools: JSON.parse(row.allowedTools),
    contextFiles: JSON.parse(row.contextFiles),
    tags: JSON.parse(row.tags),
  }
}

function serializePersona(input: PersonaInput) {
  return {
    allowedTools: JSON.stringify(input.allowedTools || []),
    contextFiles: JSON.stringify(input.contextFiles || []),
    tags: JSON.stringify(input.tags || []),
  }
}

export async function listPersonas(activeOnly = true): Promise<ParsedPersona[]> {
  const query = db.select().from(personas)
  if (activeOnly) {
    const result = await query.where(eq(personas.isActive, true)).orderBy(desc(personas.createdAt))
    return result.map(parsePersona)
  }
  const result = await query.orderBy(desc(personas.createdAt))
  return result.map(parsePersona)
}

export async function getPersona(id: string): Promise<ParsedPersona | null> {
  const [row] = await db.select().from(personas).where(eq(personas.id, id))
  return row ? parsePersona(row) : null
}

export async function createPersona(input: PersonaInput): Promise<ParsedPersona> {
  const id = generateId()
  const timestamp = now()
  const serialized = serializePersona(input)
  
  const [row] = await db.insert(personas).values({
    id,
    name: input.name,
    description: input.description || "",
    personaType: input.personaType || "custom",
    systemPrompt: input.systemPrompt,
    model: input.model || "claude-sonnet-4-5",
    provider: input.provider || "anthropic",
    allowedTools: serialized.allowedTools,
    contextFiles: serialized.contextFiles,
    tags: serialized.tags,
    isActive: true,
    createdAt: timestamp,
    updatedAt: timestamp,
  } as NewPersona).returning()
  
  return parsePersona(row)
}

export async function updatePersona(id: string, input: Partial<PersonaInput>): Promise<ParsedPersona | null> {
  const serialized = input.allowedTools || input.contextFiles || input.tags
    ? {
        allowedTools: JSON.stringify(input.allowedTools || []),
        contextFiles: JSON.stringify(input.contextFiles || []),
        tags: JSON.stringify(input.tags || []),
      }
    : {}
  
  const [row] = await db.update(personas)
    .set({
      ...input,
      ...serialized,
      updatedAt: now(),
    } as Partial<PersonaRow>)
    .where(eq(personas.id, id))
    .returning()
  
  return row ? parsePersona(row) : null
}

export async function togglePersonaActive(id: string): Promise<ParsedPersona | null> {
  const [current] = await db.select().from(personas).where(eq(personas.id, id))
  if (!current) return null
  
  const [row] = await db.update(personas)
    .set({ isActive: !current.isActive, updatedAt: now() })
    .where(eq(personas.id, id))
    .returning()
  
  return row ? parsePersona(row) : null
}

export async function deletePersona(id: string): Promise<boolean> {
  const [row] = await db.update(personas)
    .set({ isActive: false, updatedAt: now() })
    .where(eq(personas.id, id))
    .returning()
  
  return !!row
}
