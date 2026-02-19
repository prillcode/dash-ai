export const API_BASE_URL = "/api"

export const MODELS = [
  "claude-sonnet-4-5",
  "claude-sonnet-4",
  "claude-opus-4",
  "claude-haiku-4",
] as const

export const PRIORITIES = [
  { value: 1, label: "P1 - Critical" },
  { value: 2, label: "P2 - High" },
  { value: 3, label: "P3 - Medium" },
  { value: 4, label: "P4 - Low" },
  { value: 5, label: "P5 - Lowest" },
] as const
