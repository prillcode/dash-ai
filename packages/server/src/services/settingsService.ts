import { eq } from "drizzle-orm"
import { db } from "../db/client"
import { settings } from "../db/schema"

export const DEFAULT_AGENT_MD_PROMPT = `Generate a concise Agent.md file (max 150 lines) for this project.

Include these sections:

## Tech Stack
- Language(s) and version(s)
- Framework(s) and key dependencies
- Database/ORM if applicable

## Key Conventions
- Import patterns (e.g., path aliases)
- Naming conventions
- Critical coding rules specific to this project

## Architecture
- High-level directory structure
- Key directories and their purposes
- Where different types of code live

## Development Workflow
- Build/test commands
- Pre-commit requirements
- Any project-specific scripts

## Gotchas & Pitfalls
- Common mistakes for this codebase
- Non-obvious requirements
- Things that break easily

Rules:
- Use bullet points, not long paragraphs
- Be specific to THIS project (omit generic advice)
- Focus on what an AI coding agent needs to know
- Keep it under 150 lines
- Structure with clear markdown headings`

export interface DefaultSettings {
  // AI Provider defaults
  defaultProvider?: string
  defaultModel?: string

  // Persona defaults
  defaultPlannerPersonaId?: string
  defaultCoderPersonaId?: string

  // Project defaults
  defaultProjectId?: string

  // Workflow automation
  autoStartPlanning?: boolean

  // UI preferences
  uiTheme?: "dark" | "light" | "system"
  confirmDestructiveActions?: boolean

  // Agent.md generation
  agentMdPrompt?: string

  // Deployment hints (env-backed, read-only via API)
  deploymentMode?: string
  projectsRoot?: string
}

/**
 * Get a setting value by key
 * @returns the value string, or null if not found
 */
export async function getSetting(key: string): Promise<string | null> {
  const result = await db
    .select({ value: settings.value })
    .from(settings)
    .where(eq(settings.key, key))
    .limit(1)
  
  return result[0]?.value ?? null
}

/**
 * Set a setting value (upsert)
 * Uses check-then-insert/update pattern to avoid constraint issues
 */
export async function setSetting(key: string, value: string): Promise<void> {
  const now = new Date().toISOString()
  const existing = await getSetting(key)
  
  if (existing === null) {
    // Insert new
    const id = `${key}_${Date.now()}`
    await db.insert(settings).values({ id, key, value, updatedAt: now })
  } else {
    // Update existing
    await db
      .update(settings)
      .set({ value, updatedAt: now })
      .where(eq(settings.key, key))
  }
}

/**
 * Get all settings as a key-value object
 */
export async function getAllSettings(): Promise<Record<string, string>> {
  const allSettings = await db.select().from(settings)
  
  return allSettings.reduce((acc, setting) => {
    acc[setting.key] = setting.value
    return acc
  }, {} as Record<string, string>)
}

/**
 * Get structured default settings
 */
export async function getDefaultSettings(): Promise<DefaultSettings> {
  const allSettings = await getAllSettings()

  return {
    defaultProvider: allSettings.defaultProvider,
    defaultModel: allSettings.defaultModel,
    defaultPlannerPersonaId: allSettings.defaultPlannerPersonaId,
    defaultCoderPersonaId: allSettings.defaultCoderPersonaId,
    defaultProjectId: allSettings.defaultProjectId,
    autoStartPlanning: allSettings.autoStartPlanning === "true",
    uiTheme: (allSettings.uiTheme as "dark" | "light" | "system") ?? "dark",
    confirmDestructiveActions:
      allSettings.confirmDestructiveActions === "true",
    agentMdPrompt: allSettings.agentMdPrompt || DEFAULT_AGENT_MD_PROMPT,
    deploymentMode: process.env.DEPLOYMENT_MODE,
    projectsRoot: process.env.PROJECTS_ROOT,
  }
}

/**
 * Update multiple settings at once
 */
export async function updateSettings(
  newSettings: Partial<DefaultSettings>
): Promise<DefaultSettings> {
  const entries = Object.entries(newSettings).filter(
    ([, value]) => value !== undefined
  ) as [string, string | boolean][]

  for (const [key, value] of entries) {
    // Convert booleans to strings for storage
    const stringValue = typeof value === "boolean" ? String(value) : value
    await setSetting(key, stringValue)
  }

  return getDefaultSettings()
}
