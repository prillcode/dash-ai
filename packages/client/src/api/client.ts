const API_TOKEN = import.meta.env.VITE_API_TOKEN

export class ApiError extends Error {
  status: number
  details?: unknown

  constructor(status: number, message: string, details?: unknown) {
    super(message)
    this.status = status
    this.details = details
    this.name = "ApiError"
  }
}

export async function apiClient<T>(
  path: string,
  options: RequestInit = {}
): Promise<T> {
  const headers: HeadersInit = {
    "Content-Type": "application/json",
    Authorization: `Bearer ${API_TOKEN}`,
    ...options.headers,
  }

  const response = await fetch(path, {
    ...options,
    headers,
  })

  if (!response.ok) {
    let details: unknown
    try {
      details = await response.json()
    } catch {
      details = await response.text()
    }
    const message =
      typeof details === "object" && details !== null && "error" in details
        ? String(details.error)
        : `HTTP ${response.status}`
    throw new ApiError(response.status, message, details)
  }

  return response.json() as Promise<T>
}

export async function apiClientText(path: string, options: RequestInit = {}): Promise<string> {
  const headers: HeadersInit = {
    Authorization: `Bearer ${API_TOKEN}`,
    ...options.headers,
  }

  const response = await fetch(path, {
    ...options,
    headers,
  })

  if (!response.ok) {
    throw new ApiError(response.status, `HTTP ${response.status}`)
  }

  return response.text()
}
