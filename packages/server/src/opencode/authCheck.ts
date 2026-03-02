import { homedir } from "os"
import { join } from "path"
import { readFile } from "fs/promises"

interface OAuthEntry {
  type: "oauth"
  access: string
  refresh: string
  expires: number
}

interface ApiEntry {
  type: "api"
  key: string
}

type AuthEntry = OAuthEntry | ApiEntry

interface AuthJson {
  [provider: string]: AuthEntry
}

export interface AuthCheckResult {
  ok: boolean
  errorMessage?: string
}

/**
 * Reads ~/.local/share/opencode/auth.json and validates that the given
 * provider has a valid credential:
 *  - oauth: token must exist and not be expired (with 5-min buffer)
 *  - api:   key must be a non-empty string
 *
 * Also accepts ANTHROPIC_API_KEY / DEEPSEEK_API_KEY env vars as fallback,
 * since OpenCode reads those too.
 */
export async function checkProviderAuth(providerID: string): Promise<AuthCheckResult> {
  // Normalise provider ID — strip model suffix if caller passed "anthropic/claude-..."
  const provider = providerID.includes("/") ? providerID.split("/")[0] : providerID

  // 1. Check env var fallback first (OpenCode reads these automatically)
  const envVarMap: Record<string, string> = {
    anthropic: "ANTHROPIC_API_KEY",
    openai: "OPENAI_API_KEY",
    deepseek: "DEEPSEEK_API_KEY",
    google: "GOOGLE_API_KEY",
    mistral: "MISTRAL_API_KEY",
    groq: "GROQ_API_KEY",
  }
  const envVar = envVarMap[provider.toLowerCase()]
  if (envVar && process.env[envVar]) {
    return { ok: true }
  }

  // 2. Check ~/.local/share/opencode/auth.json
  const authPath = join(homedir(), ".local", "share", "opencode", "auth.json")
  let auth: AuthJson
  try {
    const raw = await readFile(authPath, "utf-8")
    auth = JSON.parse(raw)
  } catch {
    return {
      ok: false,
      errorMessage:
        `No credentials found for provider "${provider}". ` +
        `Run the OpenCode TUI and use /connect to authenticate, ` +
        `or set the ${envVar ?? `${provider.toUpperCase()}_API_KEY`} environment variable.`,
    }
  }

  const entry = auth[provider] ?? auth[provider.toLowerCase()]
  if (!entry) {
    return {
      ok: false,
      errorMessage:
        `Provider "${provider}" is not connected. ` +
        `Open the OpenCode TUI, run /connect, and authenticate with ${provider}. ` +
        `Or set the ${envVar ?? `${provider.toUpperCase()}_API_KEY`} environment variable.`,
    }
  }

  if (entry.type === "api") {
    if (!entry.key || entry.key.trim() === "") {
      return {
        ok: false,
        errorMessage:
          `API key for "${provider}" is empty. ` +
          `Re-connect in the OpenCode TUI with /connect, or set ${envVar ?? `${provider.toUpperCase()}_API_KEY`}.`,
      }
    }
    return { ok: true }
  }

  if (entry.type === "oauth") {
    if (!entry.access) {
      return {
        ok: false,
        errorMessage:
          `OAuth token for "${provider}" is missing. ` +
          `Re-connect in the OpenCode TUI with /connect.`,
      }
    }
    // 5-minute buffer to avoid using a token that expires mid-session
    const BUFFER_MS = 5 * 60 * 1000
    if (Date.now() + BUFFER_MS > entry.expires) {
      const expiredAt = new Date(entry.expires).toLocaleTimeString()
      return {
        ok: false,
        errorMessage:
          `OAuth token for "${provider}" has expired (expired at ${expiredAt}). ` +
          `Open the OpenCode TUI and run /connect to refresh your session.`,
      }
    }
    return { ok: true }
  }

  // Unknown entry type — pass through and let OpenCode handle it
  return { ok: true }
}
