import { eq, desc } from "drizzle-orm"
import { db } from "../db/client"
import { projects } from "../db/schema"
import { generateId } from "../utils/id"
import { now } from "../utils/time"
import os from "os"
import fs from "fs"

type ProjectRow = typeof projects.$inferSelect
type NewProject = typeof projects.$inferInsert

export interface ParsedProject {
  id: string
  name: string
  description: string
  path: string          // as stored (may contain ~)
  resolvedPath: string  // ~ expanded via os.homedir()
  isActive: boolean
  createdAt: string
  updatedAt: string
}

export interface ProjectInput {
  name: string
  description?: string
  path: string
}

function parseProject(row: ProjectRow): ParsedProject {
  const resolvedPath = row.path.replace(/^~(?=$|\/)/, os.homedir())
  return {
    ...row,
    resolvedPath,
  }
}

export function validateProjectPath(path: string): { valid: boolean; resolvedPath: string; error?: string } {
  const resolvedPath = path.replace(/^~(?=$|\/)/, os.homedir())
  try {
    if (!fs.existsSync(resolvedPath)) {
      return { valid: false, resolvedPath, error: "Path does not exist" }
    }
    const stat = fs.statSync(resolvedPath)
    if (!stat.isDirectory()) {
      return { valid: false, resolvedPath, error: "Path is not a directory" }
    }
    return { valid: true, resolvedPath }
  } catch (err) {
    return { valid: false, resolvedPath, error: `Unable to access path: ${err instanceof Error ? err.message : String(err)}` }
  }
}

export async function listProjects(activeOnly = true): Promise<ParsedProject[]> {
  const query = db.select().from(projects)
  if (activeOnly) {
    const result = await query.where(eq(projects.isActive, true)).orderBy(desc(projects.createdAt))
    return result.map(parseProject)
  }
  const result = await query.orderBy(desc(projects.createdAt))
  return result.map(parseProject)
}

export async function getProject(id: string): Promise<ParsedProject | null> {
  const [row] = await db.select().from(projects).where(eq(projects.id, id))
  return row ? parseProject(row) : null
}

export async function createProject(input: ProjectInput): Promise<ParsedProject> {
  const validation = validateProjectPath(input.path)
  if (!validation.valid) {
    throw new Error(`Invalid project path: ${validation.error}`)
  }

  const id = generateId()
  const timestamp = now()
  
  const [row] = await db.insert(projects).values({
    id,
    name: input.name,
    description: input.description || "",
    path: input.path,
    isActive: true,
    createdAt: timestamp,
    updatedAt: timestamp,
  } as NewProject).returning()
  
  return parseProject(row)
}

export async function updateProject(id: string, input: Partial<ProjectInput>): Promise<ParsedProject | null> {
  if (input.path) {
    const validation = validateProjectPath(input.path)
    if (!validation.valid) {
      throw new Error(`Invalid project path: ${validation.error}`)
    }
  }

  const [row] = await db.update(projects)
    .set({
      ...input,
      updatedAt: now(),
    } as Partial<ProjectRow>)
    .where(eq(projects.id, id))
    .returning()
  
  return row ? parseProject(row) : null
}

export async function deleteProject(id: string): Promise<boolean> {
  const [row] = await db.delete(projects).where(eq(projects.id, id)).returning()
  return !!row
}