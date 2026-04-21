import React, { useEffect, useRef } from "react"
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

function renderEventContent(event: TaskEvent): React.ReactNode {
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
    case "TOOL_START": {
      const payload = event.payload as { toolName?: string }
      return (
        <div className="text-sm flex items-center gap-2">
          <span className="text-yellow-400">⟳</span>
          <span className="font-medium">Tool:</span>
          <span className="text-purple font-mono">{payload.toolName || "unknown"}</span>
        </div>
      )
    }
    case "TOOL_END": {
      const payload = event.payload as { toolName?: string; isError?: boolean }
      return (
        <div className="text-sm flex items-center gap-2">
          <span className={payload.isError ? "text-danger" : "text-success"}>
            {payload.isError ? "✗" : "✓"}
          </span>
          <span className="font-medium">Tool:</span>
          <span className="text-purple font-mono">{payload.toolName || "unknown"}</span>
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
      const workItemDir = payload.workItemDir as string | undefined
      const selectedPlanFile = payload.selectedPlanFile as string | undefined
      const planningMode = payload.planningMode as string | undefined
      const durationMs = payload.durationMs as number | undefined
      const turnCount = payload.turnCount as number | undefined
      const toolStartCount = payload.toolStartCount as number | undefined
      const detectedPlanDir = payload.detectedPlanDir as string | undefined
      const expectedTargetPrefix = payload.expectedTargetPrefix as string | undefined

      const label = event.eventType === "PLANNING_EVENT" ? "Planning" : "Coding"

      // Suppress pure noise
      if (status === "server.heartbeat") {
        return (
          <div className="text-xs text-subtle italic">
            {label.toLowerCase()} · heartbeat
          </div>
        )
      }
      if (status === "message.part.delta") return null

      // Agent text output — show the actual text the model wrote
      if (status === "agent.text") {
        const text = payload.text as string
        return (
          <div className="text-sm text-text whitespace-pre-wrap font-mono bg-surface-1 rounded px-2 py-1 border-l-2 border-accent">
            {text.length > 600 ? text.slice(-600) + "…" : text}
          </div>
        )
      }

      // Agent reasoning
      if (status === "agent.reasoning") {
        const text = payload.text as string
        return (
          <div className="text-xs text-subtle italic whitespace-pre-wrap">
            <span className="font-medium not-italic">Thinking:</span>{" "}
            {text.length > 300 ? text.slice(0, 300) + "…" : text}
          </div>
        )
      }

      // Tool call running / complete
      if (status === "tool.running" || status === "tool.complete") {
        const tool = payload.tool as string
        const toolState = payload.toolState as string | undefined
        const isComplete = status === "tool.complete"
        return (
          <div className="text-sm flex items-center gap-2">
            <span className={isComplete ? "text-success" : "text-yellow-400"}>
              {isComplete ? "✓" : "⟳"}
            </span>
            <span className="text-purple font-mono">{tool}</span>
            {toolState && (
              <span className="text-xs text-subtle">{toolState}</span>
            )}
          </div>
        )
      }

      // Milestone status messages (starting, provider_ready, prompt_sent, etc.)
      const milestoneMessages: Record<string, string> = {
        starting: "Initializing...",
        creating_session: "Creating session...",
        session_created: "Session created",
        provider_ready: message ?? "Provider ready",
        sending_prompt: "Sending prompt...",
        prompt_sent: "Prompt sent, waiting for model...",
        "question.answered": "Answered interactive question",
        "session.idle": "Session complete",
        completed: "Done",
      }

      if (status === "targeting") {
        return (
          <div className="text-sm text-muted space-y-1">
            <div><span className="font-medium">{label} target:</span> {expectedTargetPrefix || "(auto)"}</div>
            {planningMode && <div className="text-xs">mode: {planningMode}</div>}
          </div>
        )
      }

      if (status === "target_resolved") {
        return (
          <div className="text-sm text-muted">
            <span className="font-medium">{label} target resolved:</span>{" "}
            <code className="text-accent">.planning/{detectedPlanDir}</code>
          </div>
        )
      }

      if (status === "launching") {
        return (
          <div className="text-sm text-muted space-y-1">
            <div>
              <span className="font-medium">{label} launching</span>
              {planningMode && <span className="ml-2 text-xs">mode: {planningMode}</span>}
            </div>
            {workItemDir && <div className="text-xs">work item: <code>{workItemDir}</code></div>}
            {selectedPlanFile && <div className="text-xs">selected doc: <code>{selectedPlanFile}</code></div>}
            {sessionId && <div className="text-xs text-subtle">session {String(sessionId).slice(0, 12)}…</div>}
          </div>
        )
      }

      if (status === "summary") {
        return (
          <div className="text-sm text-muted space-y-1">
            <div><span className="font-medium">{label} summary:</span> {message || "complete"}</div>
            <div className="text-xs">
              {durationMs !== undefined && <span>{Math.round(durationMs / 100) / 10}s</span>}
              {turnCount !== undefined && <span className="ml-2">turns: {turnCount}</span>}
              {toolStartCount !== undefined && <span className="ml-2">tools: {toolStartCount}</span>}
            </div>
            {workItemDir && <div className="text-xs">work item: <code>{workItemDir}</code></div>}
            {selectedPlanFile && <div className="text-xs">selected doc: <code>{selectedPlanFile}</code></div>}
          </div>
        )
      }

      if (status && milestoneMessages[status]) {
        return (
          <div className="text-sm">
            <span className="text-accent font-medium">{label}:</span>{" "}
            <span className="text-text">{milestoneMessages[status]}</span>
            {sessionId && (
              <span className="ml-2 text-xs text-subtle">session {String(sessionId).slice(0, 12)}…</span>
            )}
          </div>
        )
      }

      // Fallback for any other event types
      const detail = message ?? status ?? ""
      return (
        <div className="text-sm text-muted">
          <span className="font-medium">{label}:</span> {detail}
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
      {events.map((event) => {
        const content = renderEventContent(event)
        if (content === null) return null
        return (
          <div key={event.id} className="flex items-start gap-3">
            <span className="text-xs text-subtle whitespace-nowrap">
              {formatEventTime(event.createdAt)}
            </span>
            <div className="flex-1">{content}</div>
          </div>
        )
      })}
    </div>
  )
}
