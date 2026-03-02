import { Hono } from "hono"
import { z } from "zod"
import { spawn } from "child_process"
import { join } from "path"
import { homedir } from "os"
import { checkProviderAuth } from "../opencode/authCheck"

export const authRouter = new Hono()

/**
 * GET /api/auth/status?provider=anthropic
 *
 * Checks whether the given provider has valid credentials in
 * ~/.local/share/opencode/auth.json (or env vars).
 * Safe to call frequently — no side effects, just reads the file.
 */
authRouter.get("/status", async (c) => {
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
 * Spawns `opencode auth login` for the given provider, which triggers the
 * OAuth flow in the user's browser. For API-key providers this is a no-op
 * (returns a message directing the user to set an env var instead).
 *
 * The OAuth browser step cannot be automated — this just initiates the flow.
 */
authRouter.post("/refresh", async (c) => {
  const body = await c.req.json().catch(() => ({}))
  const parsed = z.object({ provider: z.string().min(1) }).safeParse(body)
  if (!parsed.success) {
    return c.json({ error: "provider is required" }, 400)
  }

  const { provider } = parsed.data

  // API-key providers can't be refreshed via CLI — guide the user instead
  const apiKeyProviders = ["deepseek", "openai", "mistral", "groq", "evroc"]
  if (apiKeyProviders.includes(provider.toLowerCase())) {
    const envVar = `${provider.toUpperCase()}_API_KEY`
    return c.json({
      ok: false,
      method: "api",
      message: `${provider} uses API key auth. Set the ${envVar} environment variable in your .env file and restart the server.`,
    })
  }

  // OAuth providers — spawn opencode auth login
  const opencodeBin = join(homedir(), ".opencode", "bin", "opencode")

  try {
    // Spawn detached so the process outlives the HTTP request
    const proc = spawn(opencodeBin, ["auth", "login"], {
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
