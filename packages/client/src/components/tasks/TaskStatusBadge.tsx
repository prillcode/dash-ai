import { Badge } from "../ui"
import { TaskStatus, type TaskStatusType } from "../../types/task"

interface TaskStatusBadgeProps {
  status: TaskStatusType
}

const statusColors: Record<TaskStatusType, "gray" | "blue" | "yellow" | "green" | "red" | "purple"> = {
  [TaskStatus.PENDING]: "gray",
  [TaskStatus.QUEUED]: "blue",
  [TaskStatus.RUNNING]: "yellow",
  [TaskStatus.AWAITING_REVIEW]: "purple",
  [TaskStatus.APPROVED]: "green",
  [TaskStatus.REJECTED]: "red",
  [TaskStatus.COMPLETE]: "green",
  [TaskStatus.FAILED]: "red",
}

export function TaskStatusBadge({ status }: TaskStatusBadgeProps) {
  const isRunning = status === TaskStatus.RUNNING

  return (
    <Badge
      color={statusColors[status]}
      className={isRunning ? "animate-pulse" : ""}
    >
      {status}
    </Badge>
  )
}
