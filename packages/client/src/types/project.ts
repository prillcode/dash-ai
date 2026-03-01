export interface Project {
  id: string
  name: string
  description: string
  path: string          // as stored
  resolvedPath: string  // ~ expanded
  isActive: boolean
  createdAt: string
  updatedAt: string
}

export interface ProjectInput {
  name: string
  description?: string
  path: string
}

export interface PathValidationResult {
  valid: boolean
  resolvedPath: string
  error?: string
}