import { Button } from "../ui"
import { useUpdateTaskStatus } from "../../api/tasks"
import { TaskStatus } from "../../types/task"

interface TaskActionBarProps {
  taskId: string
  status: string
}

export function TaskActionBar({ taskId, status }: TaskActionBarProps) {
  const updateStatus = useUpdateTaskStatus()

  const handleApprove = () => {
    updateStatus.mutate({
      id: taskId,
      status: TaskStatus.APPROVED,
      reviewedBy: "user",
    })
  }

  const handleReject = () => {
    const note = prompt("Rejection reason (optional):")
    updateStatus.mutate({
      id: taskId,
      status: TaskStatus.REJECTED,
      reviewedBy: "user",
      reviewNote: note || undefined,
    })
  }

  if (status !== TaskStatus.AWAITING_REVIEW) {
    return null
  }

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
