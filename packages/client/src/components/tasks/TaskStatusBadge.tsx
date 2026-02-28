import { Badge } from "../ui"
import { TaskStatus, type TaskStatusType } from "../../types/task"

interface TaskStatusBadgeProps {
  status: TaskStatusType
}

const statusColors: Record<TaskStatusType, "gray" | "blue" | "yellow" | "green" | "red" | "purple"> = {
  [TaskStatus.DRAFT]: "gray",
  [TaskStatus.IN_PLANNING]: "blue",
  [TaskStatus.PLANNED]: "purple",
  [TaskStatus.READY_TO_CODE]: "blue",
  [TaskStatus.QUEUED]: "blue",
  [TaskStatus.RUNNING]: "yellow",
  [TaskStatus.AWAITING_REVIEW]: "purple",
  [TaskStatus.APPROVED]: "green",
  [TaskStatus.REJECTED]: "red",
  [TaskStatus.COMPLETE]: "green",
  [TaskStatus.FAILED]: "red",
}

export function TaskStatusBadge({ status }: TaskStatusBadgeProps) {
  const isActive = status === TaskStatus.RUNNING || status === TaskStatus.IN_PLANNING

  return (
    <Badge
      color={statusColors[status]}
      className={isActive ? "animate-pulse" : ""}
    >
      {status}
    </Badge>
  )
}
