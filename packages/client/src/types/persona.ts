export const PersonaType = {
  PLANNER: "planner",
  CODER: "coder",
  REVIEWER: "reviewer",
  CUSTOM: "custom",
} as const

export type PersonaTypeValue = typeof PersonaType[keyof typeof PersonaType]

export interface PersonaPreset {
  type: PersonaTypeValue
  label: string
  description: string
  allowedTools: string[]
  provider: string
  model: string
}

export const PERSONA_PRESETS: Record<PersonaTypeValue, PersonaPreset> = {
  planner: {
    type: "planner",
    label: "Planner",
    description: "Reads the codebase and produces detailed PLAN.md files. Does not write code.",
    allowedTools: ["read", "write", "edit", "glob", "grep"],
    provider: "anthropic",
    model: "claude-opus-4-5",
  },
  coder: {
    type: "coder",
    label: "Coder",
    description: "Executes plans, writes code, runs builds and tests.",
    allowedTools: ["bash", "read", "write", "edit", "glob", "grep"],
    provider: "anthropic",
    model: "claude-sonnet-4-5",
  },
  reviewer: {
    type: "reviewer",
    label: "Reviewer",
    description: "Reviews diffs and output logs, provides feedback without modifying files.",
    allowedTools: ["read", "glob", "grep"],
    provider: "anthropic",
    model: "claude-sonnet-4-5",
  },
  custom: {
    type: "custom",
    label: "Custom",
    description: "",
    allowedTools: [],
    provider: "anthropic",
    model: "claude-sonnet-4-5",
  },
}

export interface Persona {
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
