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
      <div className="p-4 bg-red-50 text-red-600 rounded-lg">
        Failed to load diff: {error.message}
      </div>
    )
  }

  if (!diff) {
    return (
      <div className="p-4 bg-gray-50 text-gray-500 rounded-lg">
        No diff available
      </div>
    )
  }

  return (
    <div className="border rounded-lg overflow-hidden">
      <div className="bg-gray-100 px-4 py-2 border-b font-medium">
        Changes
      </div>
      <pre className="p-4 text-sm overflow-x-auto bg-gray-50">{diff}</pre>
    </div>
  )
}
