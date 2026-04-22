import { useState } from "react"
import { Button } from "../ui"
import {
  useStartPlanning,
  useUpdateTaskStatus,
  useRetryTask,
  useCancelTask,
  useQueueCoding,
} from "../../api/tasks"
import type { Task } from "../../types/task"
import { TaskStatus } from "../../types/task"
import { IterateCodingForm } from "./IterateCodingForm"

interface TaskActionBarProps {
  task: Task
}

export function TaskActionBar({ task }: TaskActionBarProps) {
  const [showIterateCodingForm, setShowIterateCodingForm] = useState(false)
  const startPlanning = useStartPlanning()
  const updateStatus = useUpdateTaskStatus()
  const cancelTask = useCancelTask()
  const retryTask = useRetryTask()
  const queueCoding = useQueueCoding()

  const canStartCoding = Boolean(task.planPath)

  const handleStartPlanning = () => {
    if (window.confirm("Start planning with " + task.planningPersonaName + "?")) {
      startPlanning.mutate(task.id)
    }
  }

  const handleQueueCoding = () => {
    if (window.confirm("Queue coding with " + task.codingPersonaName + "?")) {
      queueCoding.mutate(task.id)
    }
  }

  const handleApprove = () => {
    updateStatus.mutate({
      id: task.id,
      status: TaskStatus.APPROVED,
      reviewedBy: "user",
    })
  }

  const handleReject = () => {
    const note = prompt("Rejection reason (optional):")
    updateStatus.mutate({
      id: task.id,
      status: TaskStatus.REJECTED,
      reviewedBy: "user",
      reviewNote: note || undefined,
    })
  }

  if (task.status === TaskStatus.DRAFT) {
    if (task.planningPersonaId) {
      return (
        <div className="space-y-3">
          <div className="flex items-center gap-2">
            <Button
              variant="primary"
              onClick={handleStartPlanning}
              disabled={startPlanning.isPending}
            >
              Start Planning
            </Button>
            <Button
              variant="secondary"
              onClick={handleQueueCoding}
              disabled={queueCoding.isPending || !canStartCoding}
              title={canStartCoding ? undefined : "Create an executable plan before queueing coding"}
            >
              Skip Planning & Queue Coding
            </Button>
          </div>
        </div>
      )
    }

    return (
      <div className="space-y-3">
        <div className="flex items-center gap-2">
          <Button
            variant="primary"
            onClick={handleQueueCoding}
            disabled={queueCoding.isPending || !canStartCoding}
            title={canStartCoding ? undefined : "Create an executable plan before queueing coding"}
          >
            Queue Coding
          </Button>
        </div>
      </div>
    )
  }

  if (task.status === TaskStatus.PLANNED) {
    return null
  }

  if (task.status === TaskStatus.READY_TO_CODE) {
    return (
      <div className="space-y-3">
        <div className="flex items-center gap-2">
          <Button
            variant="primary"
            onClick={handleQueueCoding}
            disabled={queueCoding.isPending}
          >
            {queueCoding.isPending ? "Queueing..." : "Queue Coding"}
          </Button>
        </div>
      </div>
    )
  }

  if (task.status === TaskStatus.QUEUED || task.status === TaskStatus.RUNNING) {
    return (
      <div className="space-y-3">
        <div className="flex items-center gap-2">
          <Button
            variant="destructive"
            onClick={() => {
              if (window.confirm("Cancel this coding task?")) {
                cancelTask.mutate(task.id)
              }
            }}
            disabled={cancelTask.isPending}
          >
            {cancelTask.isPending ? "Canceling..." : "Cancel"}
          </Button>
        </div>
      </div>
    )
  }

  if (task.status === TaskStatus.AWAITING_REVIEW) {
    return (
      <div className="space-y-3">
        <div className="flex items-center gap-2">
          <Button
            variant="success"
            onClick={handleApprove}
            disabled={updateStatus.isPending}
          >
            Approve
          </Button>
          <Button
            variant="secondary"
            onClick={() => setShowIterateCodingForm((value) => !value)}
          >
            {showIterateCodingForm ? "Hide Feedback Form" : "Continue with Feedback"}
          </Button>
          <Button
            variant="destructive"
            onClick={handleReject}
            disabled={updateStatus.isPending}
          >
            Reject
          </Button>
        </div>
        {showIterateCodingForm && (
          <IterateCodingForm
            taskId={task.id}
            onCancel={() => setShowIterateCodingForm(false)}
            onSuccess={() => setShowIterateCodingForm(false)}
          />
        )}
      </div>
    )
  }

  if (task.status === TaskStatus.FAILED) {
    return (
      <div className="space-y-3">
        <div className="flex items-center gap-2">
          <Button
            variant="secondary"
            onClick={() => {
              if (window.confirm("Retry this task? It will be reset to DRAFT.")) {
                retryTask.mutate(task.id)
              }
            }}
            disabled={retryTask.isPending}
          >
            {retryTask.isPending ? "Retrying..." : "Retry"}
          </Button>
          {canStartCoding && (
            <Button
              variant="primary"
              onClick={() => setShowIterateCodingForm((value) => !value)}
            >
              {showIterateCodingForm ? "Hide Feedback Form" : "Continue with Feedback"}
            </Button>
          )}
        </div>
        {showIterateCodingForm && canStartCoding && (
          <IterateCodingForm
            taskId={task.id}
            onCancel={() => setShowIterateCodingForm(false)}
            onSuccess={() => setShowIterateCodingForm(false)}
          />
        )}
      </div>
    )
  }

  return null
}
