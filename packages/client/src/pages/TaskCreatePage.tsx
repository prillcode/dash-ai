import { useNavigate } from "react-router-dom"
import { useCreateTask } from "../api/tasks"
import { TaskForm } from "../components/tasks"
import { Button } from "../components/ui"
import type { TaskInput } from "../types/task"

export function TaskCreatePage() {
  const navigate = useNavigate()
  const createTask = useCreateTask()

  const handleSubmit = (data: TaskInput) => {
    createTask.mutate(data, {
      onSuccess: (task) => {
        navigate(`/tasks/${task.id}`)
      },
    })
  }

  return (
    <div className="max-w-4xl mx-auto space-y-6">
      <div className="flex items-center justify-between">
        <h1 className="text-2xl font-bold">Create Task</h1>
        <Button variant="ghost" onClick={() => navigate("/tasks")}>
          Cancel
        </Button>
      </div>

      <div className="card p-6">
        <TaskForm onSubmit={handleSubmit} isLoading={createTask.isPending} />
      </div>
    </div>
  )
}
