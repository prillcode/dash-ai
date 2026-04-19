import { serve } from "@hono/node-server"
import { WebSocketServer } from "ws"
import { createApp, runStartupChecks } from "./app"
import { startQueueWorker } from "./services/queueWorker"
import { subscribe, unsubscribe } from "./ws/taskStream"

const app = createApp()
const port = parseInt(process.env.PORT || "3000", 10)

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

runStartupChecks()

startQueueWorker().catch((err) => {
  console.error("Queue worker failed to start:", err)
})
