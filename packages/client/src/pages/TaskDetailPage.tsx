import { useParams, useNavigate } from "react-router-dom"
import { useTask } from "../api/tasks"
import { TaskStatusBadge, TaskActionBar } from "../components/tasks"
import { TaskTimelinePanel } from "../components/timeline"
import { DiffReviewPanel } from "../components/diff"
import { Spinner, Badge, Button } from "../components/ui"

export function TaskDetailPage() {
  const { id } = useParams<{ id: string }>()
  const navigate = useNavigate()
  const { data: task, isLoading, error } = useTask(id!)

  if (isLoading) {
    return (
      <div className="flex items-center justify-center h-64">
        <Spinner size="lg" />
      </div>
    )
  }

  if (error || !task) {
    return (
      <div className="p-4 bg-red-50 text-red-600 rounded-lg">
        Error loading task: {error?.message || "Task not found"}
      </div>
    )
  }

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-4">
          <Button variant="ghost" onClick={() => navigate("/tasks")}>
            ← Back
          </Button>
          <h1 className="text-2xl font-bold">{task.title}</h1>
          <TaskStatusBadge status={task.status} />
        </div>
        <TaskActionBar taskId={task.id} status={task.status} />
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        <div className="lg:col-span-2 space-y-6">
          <div className="border rounded-lg p-4">
            <h2 className="font-semibold mb-2">Description</h2>
            <p className="text-gray-700 whitespace-pre-wrap">{task.description}</p>
          </div>

          <DiffReviewPanel taskId={task.id} status={task.status} />

          <div className="border rounded-lg p-4">
            <h2 className="font-semibold mb-4">Event Timeline</h2>
            <TaskTimelinePanel taskId={task.id} taskStatus={task.status} />
          </div>
        </div>

        <div className="space-y-4">
          <div className="border rounded-lg p-4">
            <h2 className="font-semibold mb-3">Details</h2>
            <dl className="space-y-2">
              <div>
                <dt className="text-sm text-gray-500">Persona</dt>
                <dd className="font-medium">{task.personaName}</dd>
              </div>
              <div>
                <dt className="text-sm text-gray-500">Priority</dt>
                <dd>
                  <Badge color="gray">P{task.priority}</Badge>
                </dd>
              </div>
              <div>
                <dt className="text-sm text-gray-500">Repository</dt>
                <dd className="font-mono text-sm">{task.repoPath}</dd>
              </div>
              <div>
                <dt className="text-sm text-gray-500">Target Files</dt>
                <dd className="flex flex-wrap gap-1">
                  {task.targetFiles.map((file) => (
                    <Badge key={file} color="purple">{file}</Badge>
                  ))}
                </dd>
              </div>
              {task.sessionId && (
                <div>
                  <dt className="text-sm text-gray-500">Session ID</dt>
                  <dd className="font-mono text-sm">{task.sessionId}</dd>
                </div>
              )}
              {task.errorMessage && (
                <div>
                  <dt className="text-sm text-gray-500">Error</dt>
                  <dd className="text-red-600">{task.errorMessage}</dd>
                </div>
              )}
              {task.reviewedBy && (
                <div>
                  <dt className="text-sm text-gray-500">Reviewed By</dt>
                  <dd>{task.reviewedBy}</dd>
                </div>
              )}
              {task.reviewNote && (
                <div>
                  <dt className="text-sm text-gray-500">Review Note</dt>
                  <dd>{task.reviewNote}</dd>
                </div>
              )}
            </dl>
          </div>

          <div className="border rounded-lg p-4">
            <h2 className="font-semibold mb-3">Timestamps</h2>
            <dl className="space-y-2 text-sm">
              <div>
                <dt className="text-gray-500">Created</dt>
                <dd>{new Date(task.createdAt).toLocaleString()}</dd>
              </div>
              {task.startedAt && (
                <div>
                  <dt className="text-gray-500">Started</dt>
                  <dd>{new Date(task.startedAt).toLocaleString()}</dd>
                </div>
              )}
              {task.completedAt && (
                <div>
                  <dt className="text-gray-500">Completed</dt>
                  <dd>{new Date(task.completedAt).toLocaleString()}</dd>
                </div>
              )}
            </dl>
          </div>
        </div>
      </div>
    </div>
  )
}
