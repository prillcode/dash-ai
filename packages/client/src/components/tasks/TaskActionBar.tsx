import { Button } from "../ui"
import { useStartPlanning, useUpdateTaskStatus } from "../../api/tasks"
import type { Task } from "../../types/task"
import { TaskStatus } from "../../types/task"

interface TaskActionBarProps {
  task: Task
}

export function TaskActionBar({ task }: TaskActionBarProps) {
  const startPlanning = useStartPlanning()
  const updateStatus = useUpdateTaskStatus()

  const handleStartPlanning = () => {
    if (window.confirm("Start planning with " + task.planningPersonaName + "?")) {
      startPlanning.mutate(task.id)
    }
  }

  const handleStartCoding = () => {
    if (window.confirm("Start coding with " + task.codingPersonaName + "?")) {
      updateStatus.mutate({
        id: task.id,
        status: TaskStatus.READY_TO_CODE,
      })
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

  const handleCancel = () => {
    if (window.confirm("Cancel this task and reset to DRAFT?")) {
      updateStatus.mutate({
        id: task.id,
        status: TaskStatus.DRAFT,
      })
    }
  }

  // DRAFT tasks
  if (task.status === TaskStatus.DRAFT) {
    if (task.planningPersonaId) {
      return (
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
            onClick={handleStartCoding}
            disabled={updateStatus.isPending}
          >
            Skip Planning & Start Coding
          </Button>
        </div>
      )
    } else {
      return (
        <div className="flex items-center gap-2">
          <Button
            variant="primary"
            onClick={handleStartCoding}
            disabled={updateStatus.isPending}
          >
            Start Coding
          </Button>
        </div>
      )
    }
  }

  // PLANNED tasks — actions are in PlanningSection (Mark Ready to Code / Iterate Plan)
  if (task.status === TaskStatus.PLANNED) {
    return null
  }

  // READY_TO_CODE tasks (optional manual queue)
  if (task.status === TaskStatus.READY_TO_CODE) {
    return (
      <div className="flex items-center gap-2">
        <Button
          variant="primary"
          onClick={handleStartCoding}
          disabled={updateStatus.isPending}
        >
          Queue Now
        </Button>
      </div>
    )
  }

  // QUEUED or RUNNING tasks
  if (task.status === TaskStatus.QUEUED || task.status === TaskStatus.RUNNING) {
    return (
      <div className="flex items-center gap-2">
        <Button
          variant="destructive"
          onClick={handleCancel}
          disabled={updateStatus.isPending}
        >
          Cancel
        </Button>
      </div>
    )
  }

  // AWAITING_REVIEW tasks
  if (task.status === TaskStatus.AWAITING_REVIEW) {
    return (
      <div className="flex items-center gap-2">
        <Button
          variant="success"
          onClick={handleApprove}
          disabled={updateStatus.isPending}
        >
          Approve
        </Button>
        <Button
          variant="destructive"
          onClick={handleReject}
          disabled={updateStatus.isPending}
        >
          Reject
        </Button>
      </div>
    )
  }

  // No actions for other statuses
  return null
}
