export interface Persona {
  id: string
  name: string
  description: string
  systemPrompt: string
  model: string
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
  systemPrompt: string
  model?: string
  allowedTools?: string[]
  contextFiles?: string[]
  tags?: string[]
}
