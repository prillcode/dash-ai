import { useState, useEffect } from "react"
import { useNavigate, useSearchParams } from "react-router-dom"
import { useCreateTask, useStartPlanning } from "../api/tasks"
import { useSettings } from "../api/settings"
import { TaskForm } from "../components/tasks"
import { Button, Spinner } from "../components/ui"
import type { TaskInput } from "../types/task"

export function TaskCreatePage() {
  const navigate = useNavigate()
  const [searchParams] = useSearchParams()
  const projectIdFromUrl = searchParams.get("projectId")
  
  const { data: settings, isLoading: isLoadingSettings } = useSettings()
  const createTask = useCreateTask()
  const startPlanning = useStartPlanning()
  
  const [autoStartPlanning, setAutoStartPlanning] = useState(false)
  const [isAutoStarting, setIsAutoStarting] = useState(false)

  // Initialize auto-start from settings
  useEffect(() => {
    if (settings) {
      setAutoStartPlanning(settings.autoStartPlanning || false)
    }
  }, [settings])

  // Build initial data from settings + URL params
  const initialData = {
    projectId: projectIdFromUrl || settings?.defaultProjectId || "",
    planningPersonaId: settings?.defaultPlannerPersonaId || "",
    codingPersonaId: settings?.defaultCoderPersonaId || "",
  }

  const hasDefaults = Boolean(
    settings?.defaultProjectId ||
    settings?.defaultPlannerPersonaId ||
    settings?.defaultCoderPersonaId
  )

  const handleSubmit = async (data: TaskInput) => {
    createTask.mutate(data, {
      onSuccess: async (task) => {
        if (autoStartPlanning && task.id) {
          setIsAutoStarting(true)
          try {
            await startPlanning.mutateAsync(task.id)
          } catch (err) {
            console.error("Auto-start planning failed:", err)
            // Task was created, just show warning
          } finally {
            setIsAutoStarting(false)
          }
        }
        navigate(`/tasks/${task.id}`)
      },
    })
  }

  if (isLoadingSettings) {
    return (
      <div className="max-w-4xl mx-auto space-y-6">
        <div className="flex items-center justify-center h-64">
          <Spinner />
        </div>
      </div>
    )
  }

  return (
    <div className="max-w-4xl mx-auto space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold">Create Task</h1>
          {hasDefaults && (
            <p className="text-sm text-subtle mt-1">
              Using defaults from{" "}
              <a href="/settings" className="text-accent hover:underline">
                Settings
              </a>
            </p>
          )}
        </div>
        <Button variant="ghost" onClick={() => navigate("/tasks")}>
          Cancel
        </Button>
      </div>

      <div className="card p-6 space-y-4">
        <TaskForm 
          initialData={initialData} 
          onSubmit={handleSubmit} 
          isLoading={createTask.isPending || isAutoStarting} 
        />
        
        {/* Auto-start planning toggle */}
        <div className="pt-4 border-t border-border">
          <label className="flex items-center gap-3 cursor-pointer">
            <input
              type="checkbox"
              checked={autoStartPlanning}
              onChange={(e) => setAutoStartPlanning(e.target.checked)}
              className="w-4 h-4 rounded border-border text-accent focus:ring-accent"
            />
            <span className="text-sm text-text">
              Start planning immediately after creation
            </span>
          </label>
          <p className="text-xs text-subtle ml-7">
            The AI will begin generating a plan as soon as the task is created.
            {settings?.autoStartPlanning && " (Enabled by default in Settings)"}
          </p>
        </div>
      </div>
    </div>
  )
}
