import "./env"
import { Hono } from "hono"
import { cors } from "hono/cors"
import { logger } from "hono/logger"
import { serveStatic } from "@hono/node-server/serve-static"
import { readFileSync, existsSync } from "fs"
import { dirname, join, resolve } from "path"
import { homedir } from "os"
import { fileURLToPath } from "url"
import { personasRouter } from "./routes/personas"
import { tasksRouter } from "./routes/tasks"
import { eventsRouter } from "./routes/events"
import { modelsRouter } from "./routes/models"
import { projectsRouter } from "./routes/projects"
import { authRouter } from "./routes/auth"
import { settingsRouter } from "./routes/settings"
import { authMiddleware } from "./middleware/auth"
import { loggerMiddleware } from "./middleware/logger"
import { getModelRegistry } from "./agent/piSession"

function getPiAgentDir(): string {
  return process.env.PI_AGENT_DIR
    ? resolve(process.env.PI_AGENT_DIR.replace(/^~/, homedir()))
    : join(homedir(), ".pi", "agent")
}

function getSkillsDirCandidates(): string[] {
  const piSkills = join(getPiAgentDir(), "skills")
  const legacySkills = join(homedir(), ".agents", "skills")
  return [piSkills, legacySkills]
}

export interface AppOptions {
  /** Path to the client dist directory (for serving the React UI). */
  clientDistPath?: string
  /** Skip pi-native skills and SDK initialization checks (for testing/embedded). */
  skipStartupChecks?: boolean
}

/**
 * Create the shared Hono app with all middleware and routes registered.
 * Used by both the standalone server entry point and the embedded CLI server.
 */
function getDefaultClientDistPath(): string {
  if (process.env.CLIENT_DIST_PATH) {
    return resolve(process.env.CLIENT_DIST_PATH.replace(/^~/, homedir()))
  }

  const currentDir = dirname(fileURLToPath(import.meta.url))

  const candidates = [
    // Running from packages/server/dist
    resolve(currentDir, "../../client/dist"),
    // Running from packages/server/src via tsx
    resolve(currentDir, "../../client/dist"),
    // Fallback for unexpected cwd-based launches
    resolve(process.cwd(), "packages/client/dist"),
    resolve(process.cwd(), "../client/dist"),
  ]

  return candidates.find((candidate) => existsSync(join(candidate, "index.html"))) ?? candidates[0]
}

export function createApp(options: AppOptions = {}): Hono {
  const {
    clientDistPath,
    skipStartupChecks = false,
  } = options

  const app = new Hono()
  const distPath = clientDistPath ?? getDefaultClientDistPath()

  app.use("*", cors())
  app.use("*", logger())
  app.use("*", loggerMiddleware)

  app.get("/api/health", (c) => c.json({ status: "ok" }))
  app.route("/api/models", modelsRouter)

  app.use("/api/*", authMiddleware)

  app.route("/api/personas", personasRouter)
  app.route("/api/tasks", tasksRouter)
  app.route("/api/tasks/:taskId/events", eventsRouter)
  app.route("/api/projects", projectsRouter)
  app.route("/api/auth", authRouter)
  app.route("/api/settings", settingsRouter)

  app.use("/*", serveStatic({ root: distPath }))

  app.notFound((c) => {
    const indexPath = join(distPath, "index.html")
    if (existsSync(indexPath)) {
      return c.html(readFileSync(indexPath, "utf-8"))
    }
    return c.html("<html><body><h1>Dash AI</h1><p>Frontend not built</p></body></html>")
  })

  if (!skipStartupChecks) {
    runStartupChecks()
  }

  return app
}

/**
 * Print startup warnings about missing skills and unconfigured models.
 * Safe to call once per process — not called automatically in embedded/CLI mode.
 */
export function runStartupChecks(): void {
  const requiredSkills = ["start-work-begin", "start-work-plan", "start-work-run"]
  const skillDirs = getSkillsDirCandidates()
  const missing = requiredSkills.filter(
    (skill) => !skillDirs.some((dir) => existsSync(join(dir, skill)))
  )
  if (missing.length > 0) {
    console.warn(`⚠️  Missing pi-native skills: ${missing.join(", ")}`)
    console.warn("    Planning and coding tasks will fail until skills are installed.")
    console.warn(`    Expected location: ${skillDirs.join(" or ")}`)
  }

  try {
    const registry = getModelRegistry()
    const available = registry.getAvailable()
    if (available.length === 0) {
      console.warn("⚠️  No AI models available. Configure API keys:")
      console.warn("    - Set ANTHROPIC_API_KEY, OPENAI_API_KEY, etc. env vars")
      console.warn("    - Or run: pi /login")
    } else {
      const providers = [...new Set(available.map(m => m.provider))]
      console.log(`Pi SDK initialized: ${available.length} models available from ${providers.join(", ")}`)
    }
  } catch (err: any) {
    console.warn(`⚠️  Pi SDK initialization warning: ${err.message}`)
  }
}
