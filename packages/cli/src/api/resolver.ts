import { ensureEmbeddedServer, teardownEmbeddedServer } from "../embedded/server"
import { DashAiClient } from "./client"
import type { CliContext } from "../context"

export interface ResolvedClient {
  client: DashAiClient
  embedded: boolean
}

/**
 * Resolve which mode to operate in based on CLI context:
 * - Thin client: DASH_AI_URL + DASH_AI_TOKEN env vars (or --url/--token flags)
 * - Embedded: no config → spin up in-process server
 */
export async function resolveClient(ctx: CliContext): Promise<ResolvedClient> {
  const url = ctx.url || process.env.DASH_AI_URL
  const token = ctx.token || process.env.DASH_AI_TOKEN

  if (url && token) {
    return { client: new DashAiClient(url, token), embedded: false }
  }

  // Embedded mode
  const { url: embeddedUrl, token: embeddedToken } = await ensureEmbeddedServer()
  return { client: new DashAiClient(embeddedUrl, embeddedToken), embedded: true }
}

/**
 * Helper to automatically teardown embedded server after a command completes.
 * Usage:
 *   const { client, embedded } = await resolveClient(ctx)
 *   await withClient(client, embedded, async (client) => {
 *     const tasks = await client.get('/api/tasks')
 *     console.log(tasks)
 *   })
 */
export async function withClient<T>(
  ctx: CliContext,
  fn: (client: DashAiClient) => Promise<T>
): Promise<T> {
  const { client, embedded } = await resolveClient(ctx)
  try {
    return await fn(client)
  } finally {
    if (embedded) {
      await teardownEmbeddedServer()
    }
  }
}
