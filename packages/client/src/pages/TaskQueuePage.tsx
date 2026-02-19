import { useState } from "react"
import { useTasks } from "../api/tasks"
import { TaskCard, TaskFilterBar } from "../components/tasks"
import { Spinner, EmptyState, Button } from "../components/ui"
import { useNavigate } from "react-router-dom"
import type { TaskFilters } from "../types/task"

export function TaskQueuePage() {
  const navigate = useNavigate()
  const [filters, setFilters] = useState<TaskFilters>({})
  const { data: tasks, isLoading, error } = useTasks(filters)

  if (isLoading) {
    return (
      <div className="flex items-center justify-center h-64">
        <Spinner size="lg" />
      </div>
    )
  }

  if (error) {
    return (
      <div className="p-4 bg-red-50 text-red-600 rounded-lg">
        Error loading tasks: {error.message}
      </div>
    )
  }

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <h1 className="text-2xl font-bold">Task Queue</h1>
        <Button onClick={() => navigate("/tasks/new")}>New Task</Button>
      </div>

      <TaskFilterBar filters={filters} onFilterChange={setFilters} />

      {!tasks || tasks.length === 0 ? (
        <EmptyState
          heading="No tasks found"
          description="Create a new task to get started"
          action={<Button onClick={() => navigate("/tasks/new")}>Create Task</Button>}
        />
      ) : (
        <div className="space-y-4">
          {tasks.map((task) => (
            <TaskCard key={task.id} task={task} />
          ))}
        </div>
      )}
    </div>
  )
}
