import { useState } from "react"
import { useStartPlanning, useMarkReadyToCode } from "../../api/tasks"
import { Button } from "../ui"
import { PlanDocViewer } from "./PlanDocViewer"
import { IteratePlanForm } from "./IteratePlanForm"
import type { Task } from "../../types/task"

interface PlanningSectionProps {
  task: Task
}

const PLANNING_STATES = ["DRAFT", "IN_PLANNING", "PLANNED", "READY_TO_CODE"] as const

export function PlanningSection({ task }: PlanningSectionProps) {
  const [showIterateForm, setShowIterateForm] = useState(false)
  const startPlanning = useStartPlanning()
  const markReadyToCode = useMarkReadyToCode()

  // Only show for tasks that have or will have a planning persona
  if (!task.planningPersonaId && !PLANNING_STATES.slice(1).includes(task.status as any)) {
    return null
  }
  // DRAFT without a planning persona = skip entirely
  if (task.status === "DRAFT" && !task.planningPersonaId) {
    return null
  }

  const showDocViewers =
    (task.status === "PLANNED" || task.status === "READY_TO_CODE") && !!task.planPath

  return (
    <div className="card p-4 space-y-4">
      <h2 className="font-semibold">Planning</h2>

      {/* Status message */}
      {task.status === "DRAFT" && task.planningPersonaId && (
        <p className="text-sm text-muted">
          Ready to start AI planning with{" "}
          <span className="font-medium text-text">{task.planningPersonaName}</span>.
        </p>
      )}

      {task.status === "IN_PLANNING" && (
        <p className="text-sm text-accent animate-pulse">
          AI is generating the plan… Check back soon.
        </p>
      )}

      {task.status === "PLANNED" && (
        <p className="text-sm text-success">
          Plan ready for review
          {task.planPath && (
            <>
              {" — docs at "}
              <code className="bg-hover-subtle px-1 rounded text-xs">.planning/{task.planPath}/</code>
            </>
          )}
        </p>
      )}

      {task.status === "READY_TO_CODE" && (
        <p className="text-sm text-muted">Plan approved — in queue for coding.</p>
      )}

      {/* Plan doc viewers */}
      {showDocViewers && (
        <div className="space-y-2">
          <PlanDocViewer taskId={task.id} file="BRIEF.md" title="Brief" />
          <PlanDocViewer taskId={task.id} file="ROADMAP.md" title="Roadmap" />
        </div>
      )}

      {/* Iterate Plan form (PLANNED state) */}
      {task.status === "PLANNED" && showIterateForm && (
        <IteratePlanForm
          taskId={task.id}
          onCancel={() => setShowIterateForm(false)}
          onSuccess={() => setShowIterateForm(false)}
        />
      )}

      {/* Action buttons */}
      {task.status === "DRAFT" && task.planningPersonaId && (
        <div className="flex gap-2 pt-2 border-t border-border">
          <Button
            variant="primary"
            onClick={() => startPlanning.mutate(task.id)}
            disabled={startPlanning.isPending}
          >
            {startPlanning.isPending ? "Starting..." : "Start Planning"}
          </Button>
        </div>
      )}

      {task.status === "PLANNED" && !showIterateForm && (
        <div className="flex gap-2 pt-2 border-t border-border">
          <Button
            variant="success"
            onClick={() => markReadyToCode.mutate(task.id)}
            disabled={markReadyToCode.isPending}
          >
            {markReadyToCode.isPending ? "Updating..." : "Mark Ready to Code"}
          </Button>
          <Button
            variant="secondary"
            onClick={() => setShowIterateForm(true)}
          >
            Iterate Plan
          </Button>
        </div>
      )}
    </div>
  )
}
