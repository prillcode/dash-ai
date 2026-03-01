import { useTaskDiff } from "../../api/tasks"
import { TaskStatus } from "../../types/task"
import { Spinner } from "../ui"

interface DiffReviewPanelProps {
  taskId: string
  status: string
}

export function DiffReviewPanel({ taskId, status }: DiffReviewPanelProps) {
  const isAwaitingReview = status === TaskStatus.AWAITING_REVIEW
  const { data: diff, isLoading, error } = useTaskDiff(taskId, isAwaitingReview)

  if (!isAwaitingReview) {
    return null
  }

  if (isLoading) {
    return (
      <div className="flex items-center justify-center py-8">
        <Spinner />
      </div>
    )
  }

  if (error) {
    return (
      <div className="error-banner">
        Failed to load diff: {error.message}
      </div>
    )
  }

  if (!diff) {
    return (
      <div className="card p-4 text-muted">
        No diff available
      </div>
    )
  }

  return (
    <div className="card overflow-hidden">
      <div className="bg-hover-subtle px-4 py-2 border-b border-border font-medium text-sm text-muted">
        Changes
      </div>
      <pre className="p-4 text-sm overflow-x-auto bg-hover text-text font-mono">{diff}</pre>
    </div>
  )
}
