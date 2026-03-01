import "./env"
import { Hono } from "hono"
import { cors } from "hono/cors"
import { logger } from "hono/logger"
import { serveStatic } from "@hono/node-server/serve-static"
import { serve } from "@hono/node-server"
import { WebSocketServer } from "ws"
import { readFileSync, existsSync } from "fs"
import { join } from "path"
import { personasRouter } from "./routes/personas"
import { tasksRouter } from "./routes/tasks"
import { eventsRouter } from "./routes/events"
import { modelsRouter } from "./routes/models"
import { projectsRouter } from "./routes/projects"
import { authMiddleware } from "./middleware/auth"
import { loggerMiddleware } from "./middleware/logger"
import { startQueueWorker } from "./services/queueWorker"
import { checkSkillsInstalled } from "./opencode/planningRunner"
import { subscribe, unsubscribe } from "./ws/taskStream"

const app = new Hono()
const port = parseInt(process.env.PORT || "3000", 10)
const clientDistPath = join(process.cwd(), "../client/dist")

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

app.use("/*", serveStatic({ root: clientDistPath }))

app.notFound((c) => {
  const indexPath = join(clientDistPath, "index.html")
  if (existsSync(indexPath)) {
    return c.html(readFileSync(indexPath, "utf-8"))
  }
  return c.html("<html><body><h1>Dash AI</h1><p>Frontend not built</p></body></html>")
})

const server = serve({
  fetch: app.fetch,
  port,
})

const wss = new WebSocketServer({ noServer: true })

server.on("upgrade", (request, socket, head) => {
  const url = new URL(request.url || "", `http://localhost:${port}`)
  const match = url.pathname.match(/\/ws\/tasks\/([^/]+)\/stream/)
  
  if (match) {
    const taskId = match[1]
    wss.handleUpgrade(request, socket, head, (ws) => {
      subscribe(taskId, ws)
      ws.on("close", () => unsubscribe(taskId, ws))
    })
  }
})

console.log(`Dash AI server running on http://localhost:${port}`)

const skillCheck = checkSkillsInstalled()
if (!skillCheck.ok) {
  console.warn(`⚠️  Warning: Missing planning skills: ${skillCheck.missing.join(", ")}`)
  console.warn("    Planning tasks will fail until skills are installed at ~/.agents/skills/")
  console.warn("    Install with: npx @prillcode/start-work")
}

startQueueWorker().catch((err) => {
  console.error("Queue worker failed to start:", err)
})
