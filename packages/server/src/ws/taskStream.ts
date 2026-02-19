import type { WebSocket } from "ws"

type TaskEvent = {
  id: string
  taskId: string
  eventType: string
  payload: unknown
  createdAt: string
}

const registry = new Map<string, Set<WebSocket>>()

export function subscribe(taskId: string, ws: WebSocket) {
  if (!registry.has(taskId)) {
    registry.set(taskId, new Set())
  }
  registry.get(taskId)!.add(ws)
}

export function unsubscribe(taskId: string, ws: WebSocket) {
  const subscribers = registry.get(taskId)
  if (subscribers) {
    subscribers.delete(ws)
    if (subscribers.size === 0) {
      registry.delete(taskId)
    }
  }
}

export function broadcast(taskId: string, event: TaskEvent) {
  const subscribers = registry.get(taskId)
  if (!subscribers) return
  
  const message = JSON.stringify(event)
  for (const ws of subscribers) {
    if (ws.readyState === 1) {
      ws.send(message)
    }
  }
}
