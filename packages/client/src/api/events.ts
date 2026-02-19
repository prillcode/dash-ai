import { useQuery } from "@tanstack/react-query"
import { useEffect, useState, useRef } from "react"
import { apiClient } from "./client"
import type { TaskEvent } from "../types/task"

export function useTaskEvents(taskId: string) {
  return useQuery({
    queryKey: ["task-events", taskId],
    queryFn: () => apiClient<TaskEvent[]>(`/api/tasks/${taskId}/events`),
    staleTime: Infinity,
  })
}

export function useTaskEventStream(taskId: string, isRunning: boolean) {
  const [liveEvents, setLiveEvents] = useState<TaskEvent[]>([])
  const wsRef = useRef<WebSocket | null>(null)

  const { data: initialEvents = [] } = useTaskEvents(taskId)

  useEffect(() => {
    if (!isRunning) {
      if (wsRef.current) {
        wsRef.current.close()
        wsRef.current = null
      }
      return
    }

    if (wsRef.current) return

    const protocol = window.location.protocol === "https:" ? "wss:" : "ws:"
    const ws = new WebSocket(`${protocol}//${window.location.host}/ws/tasks/${taskId}/stream`)
    wsRef.current = ws

    ws.onmessage = (msg) => {
      try {
        const event = JSON.parse(msg.data) as TaskEvent
        setLiveEvents((prev) => [...prev, event])
      } catch (e) {
        console.error("Failed to parse WebSocket message:", e)
      }
    }

    ws.onerror = (e) => {
      console.error("WebSocket error:", e)
    }

    return () => {
      ws.close()
      wsRef.current = null
    }
  }, [taskId, isRunning])

  return [...initialEvents, ...liveEvents]
}
