import { useEffect, useRef } from "react"
import { useTaskEventStream } from "../../api/events"
import { TaskStatus } from "../../types/task"
import type { TaskEvent, TaskStatusType } from "../../types/task"
import { Spinner } from "../ui"

interface TaskTimelinePanelProps {
  taskId: string
  taskStatus: TaskStatusType
}

function formatEventTime(timestamp: string): string {
  return new Date(timestamp).toLocaleTimeString()
}

function renderEventContent(event: TaskEvent) {
  switch (event.eventType) {
    case "STATUS_CHANGE": {
      const payload = event.payload as { from: string; to: string }
      return (
        <div className="text-sm">
          <span className="font-medium">Status changed:</span>{" "}
          <span className="text-muted">{payload.from}</span> →{" "}
          <span className="text-accent">{payload.to}</span>
        </div>
      )
    }
    case "TOOL_CALL": {
      const payload = event.payload as {
        tool: string
        durationMs: number
        success: boolean
      }
      return (
        <div className="text-sm">
          <span className="font-medium">Tool:</span>{" "}
          <span className="text-purple">{payload.tool}</span>{" "}
          <span className="text-subtle">({payload.durationMs}ms)</span>{" "}
          {payload.success ? "✓" : "✗"}
        </div>
      )
    }
    case "AGENT_OUTPUT": {
      const payload = event.payload as { text: string }
      return (
        <div className="text-sm text-text whitespace-pre-wrap">
          {payload.text}
        </div>
      )
    }
    case "ERROR": {
      const payload = event.payload as { message: string }
      return (
        <div className="text-sm text-danger">
          <span className="font-medium">Error:</span> {payload.message}
        </div>
      )
    }
    case "REVIEW_ACTION": {
      const payload = event.payload as {
        action: string
        reviewedBy: string
        note?: string
      }
      return (
        <div className="text-sm">
          <span className="font-medium">Review:</span>{" "}
          <span className={payload.action === "APPROVED" ? "text-success" : "text-danger"}>
            {payload.action}
          </span>{" "}
          by {payload.reviewedBy}
          {payload.note && <span className="text-muted"> - {payload.note}</span>}
        </div>
      )
    }
    case "PLANNING_EVENT":
    case "CODING_EVENT": {
      const payload = event.payload as Record<string, unknown>
      const status = payload.status as string | undefined
      const message = payload.message as string | undefined
      const sessionId = payload.sessionId as string | undefined
      const eventType = payload.eventType as string | undefined

      // Render heartbeats in a subdued style to reduce noise
      if (status === "server.heartbeat") {
        return (
          <div className="text-xs text-subtle italic">
            {event.eventType === "PLANNING_EVENT" ? "planning" : "coding"} · heartbeat
          </div>
        )
      }

      const label = event.eventType === "PLANNING_EVENT" ? "Planning" : "Coding"
      const detail = message ?? eventType ?? status ?? ""

      return (
        <div className="text-sm">
          <span className="text-accent font-medium">{label}:</span>{" "}
          <span className="text-text">{detail || status}</span>
          {sessionId && (
            <span className="ml-2 text-xs text-subtle">session {sessionId.slice(0, 12)}…</span>
          )}
        </div>
      )
    }
    default:
      return <div className="text-sm text-muted">{event.eventType}</div>
  }
}

export function TaskTimelinePanel({ taskId, taskStatus }: TaskTimelinePanelProps) {
  const isLive =
    taskStatus === TaskStatus.IN_PLANNING ||
    taskStatus === TaskStatus.RUNNING ||
    taskStatus === TaskStatus.QUEUED
  const events = useTaskEventStream(taskId, isLive)
  const containerRef = useRef<HTMLDivElement>(null)

  useEffect(() => {
    if (containerRef.current) {
      containerRef.current.scrollTop = containerRef.current.scrollHeight
    }
  }, [events.length])

  if (events.length === 0) {
    return (
      <div className="flex items-center justify-center py-8 text-muted">
        {isLive ? (
          <>
            <Spinner className="mr-2" />
            Waiting for events...
          </>
        ) : (
          "No events yet"
        )}
      </div>
    )
  }

  return (
    <div
      ref={containerRef}
      className="scroll-panel"
    >
      {events.map((event) => (
        <div key={event.id} className="flex items-start gap-3">
          <span className="text-xs text-subtle whitespace-nowrap">
            {formatEventTime(event.createdAt)}
          </span>
          <div className="flex-1">{renderEventContent(event)}</div>
        </div>
      ))}
    </div>
  )
}
