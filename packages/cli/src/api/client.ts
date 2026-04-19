export class ApiError extends Error {
  constructor(
    public status: number,
    public code: number,
    message: string
  ) {
    super(message)
    this.name = "ApiError"
  }
}

export class DashAiClient {
  constructor(
    private url: string,
    private token: string
  ) {}

  private authHeaders(): Record<string, string> {
    return {
      Authorization: `Bearer ${this.token}`,
      "Content-Type": "application/json",
    }
  }

  private async request<T>(method: string, path: string, body?: unknown): Promise<T> {
    const res = await fetch(`${this.url}${path}`, {
      method,
      headers: this.authHeaders(),
      body: body !== undefined ? JSON.stringify(body) : undefined,
    })

    if (!res.ok) {
      let message = `HTTP ${res.status}`
      let code = 1
      try {
        const json = await res.json()
        message = json.error ?? json.message ?? message
      } catch { /* ignore */ }

      if (res.status === 404) code = 3
      else if (res.status === 401 || res.status === 403) code = 4

      throw new ApiError(res.status, code, message)
    }

    // Diff endpoint returns plain text
    if (res.headers.get("content-type")?.includes("text/")) {
      return (await res.text()) as unknown as T
    }

    return res.json() as Promise<T>
  }

  get<T>(path: string): Promise<T> {
    return this.request<T>("GET", path)
  }

  post<T>(path: string, body?: unknown): Promise<T> {
    return this.request<T>("POST", path, body)
  }

  patch<T>(path: string, body?: unknown): Promise<T> {
    return this.request<T>("PATCH", path, body)
  }

  put<T>(path: string, body?: unknown): Promise<T> {
    return this.request<T>("PUT", path, body)
  }

  delete<T>(path: string): Promise<T> {
    return this.request<T>("DELETE", path)
  }
}
