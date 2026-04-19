import { Hono } from "hono"
import { z } from "zod"
import { spawn } from "child_process"
import { join } from "path"
import { homedir } from "os"
import { existsSync } from "fs"
import { checkProviderAuth, getModelRegistry } from "../agent/piSession"

export const authRouter = new Hono()

/**
 * GET /api/auth/status
 *
 * Returns overall auth configuration status — all providers, model counts.
 * This is what the frontend auth banner should call.
 * No query params needed.
 */
authRouter.get("/status", async (c) => {
  const registry = getModelRegistry()
  const available = registry.getAvailable()
  const allModels = registry.getAll()

  const availableProviders = [...new Set(available.map(m => m.provider))]
  const allProviders = [...new Set(allModels.map(m => m.provider))]

  return c.json({
    configured: available.length > 0,
    availableProviders,
    allProviders,
    modelCount: available.length,
    totalModelCount: allModels.length,
  })
})

/**
 * GET /api/auth/provider?provider=anthropic
 *
 * Checks whether a specific provider has valid credentials.
 */
authRouter.get("/provider", async (c) => {
  const provider = c.req.query("provider")
  if (!provider) {
    return c.json({ error: "provider query param is required" }, 400)
  }

  const result = await checkProviderAuth(provider)
  return c.json({
    ok: result.ok,
    provider,
    errorMessage: result.errorMessage ?? null,
  })
})

/**
 * POST /api/auth/refresh
 * Body: { provider: string }
 *
 * Spawns `pi` for the given provider to trigger the login flow.
 * For API-key providers this is a no-op (returns a message directing
 * the user to set an env var instead).
 */
authRouter.post("/refresh", async (c) => {
  const body = await c.req.json().catch(() => ({}))
  const parsed = z.object({ provider: z.string().min(1) }).safeParse(body)
  if (!parsed.success) {
    return c.json({ error: "provider is required" }, 400)
  }

  const { provider } = parsed.data

  // API-key providers can't be refreshed via login flow — guide the user instead
  const apiKeyProviders = ["deepseek", "openai", "mistral", "groq", "evroc"]
  if (apiKeyProviders.includes(provider.toLowerCase())) {
    const envVar = `${provider.toUpperCase()}_API_KEY`
    return c.json({
      ok: false,
      method: "api",
      message: `${provider} uses API key auth. Set the ${envVar} environment variable in your .env file and restart the server.`,
    })
  }

  // OAuth providers — spawn pi login
  const piBin = join(homedir(), ".pi", "bin", "pi")

  // Check if pi binary exists
  if (!existsSync(piBin)) {
    return c.json({
      ok: false,
      method: "oauth",
      message: `Pi CLI not found at ${piBin}. Install it first: curl -fsSL https://pi.codes/install | sh`,
    }, 500)
  }

  try {
    // Spawn detached so the process outlives the HTTP request
    const proc = spawn(piBin, ["login"], {
      detached: true,
      stdio: "ignore",
      env: { ...process.env },
    })
    proc.unref()

    return c.json({
      ok: true,
      method: "oauth",
      message: `OAuth login flow started for ${provider}. Complete the browser step, then retry your task.`,
    })
  } catch (err) {
    const msg = err instanceof Error ? err.message : String(err)
    return c.json({ ok: false, method: "oauth", message: `Failed to start auth flow: ${msg}` }, 500)
  }
})
