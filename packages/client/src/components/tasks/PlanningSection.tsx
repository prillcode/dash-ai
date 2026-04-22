import { useState } from "react"
import { useStartPlanning, useMarkReadyToCode, useValidateTask } from "../../api/tasks"
import type { ValidationResult } from "../../api/tasks"
import { Button } from "../ui"
import { PlanDocViewer } from "./PlanDocViewer"
import { IteratePlanForm } from "./IteratePlanForm"
import type { Task } from "../../types/task"

interface PlanningSectionProps {
  task: Task
}

const VALIDATE_STATES = ["IN_PLANNING", "PLANNED", "READY_TO_CODE", "FAILED", "RUNNING"] as const

export function PlanningSection({ task }: PlanningSectionProps) {
  const [showIterateForm, setShowIterateForm] = useState(false)
  const [validationResult, setValidationResult] = useState<ValidationResult | null>(null)
  const startPlanning = useStartPlanning()
  const markReadyToCode = useMarkReadyToCode()
  const validateTask = useValidateTask(task.id)

  if (!task.planningPersonaId && !task.planPath) {
    return null
  }

  const showDocViewers = task.status !== "IN_PLANNING" && !!task.planPath

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
        <p className="text-sm text-muted">Plan approved — ready to queue coding when you want to run it.</p>
      )}

      {/* Plan doc viewers */}
      {showDocViewers && (
        <div className="space-y-2">
          <PlanDocViewer taskId={task.id} file="BRIEF.md" title="Brief" />
          <PlanDocViewer taskId={task.id} file="ROADMAP.md" title="Roadmap" />
          <PlanDocViewer taskId={task.id} file="EXECUTION.md" title="Execution" />
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

      {/* Validate button — shown when work may have been done but status is uncertain */}
      {VALIDATE_STATES.includes(task.status as any) && (
        <div className="pt-2 border-t border-border space-y-3">
          <Button
            variant="secondary"
            onClick={() =>
              validateTask.mutate(undefined, {
                onSuccess: (result) => setValidationResult(result),
              })
            }
            disabled={validateTask.isPending}
          >
            {validateTask.isPending ? "Checking…" : "Validate"}
          </Button>

          {validateTask.isError && (
            <p className="text-sm text-error">Validation failed — {String(validateTask.error)}</p>
          )}

          {validationResult && (
            <div className="space-y-2 text-sm">
              {/* Summary badge */}
              <div className={`flex items-center gap-2 font-medium ${validationResult.likelyComplete ? "text-success" : "text-warning"}`}>
                <span>{validationResult.likelyComplete ? "✓" : "○"}</span>
                <span>{validationResult.likelyComplete ? "Work appears complete" : "No evidence of completion"}</span>
              </div>
              <p className="text-muted">{validationResult.summary}</p>

              {/* Recent commits */}
              {validationResult.recentCommits.length > 0 && (
                <details className="border border-border rounded">
                  <summary className="px-3 py-2 cursor-pointer bg-hover-subtle hover:bg-border rounded text-xs font-medium select-none">
                    {validationResult.recentCommits.length} recent commit{validationResult.recentCommits.length > 1 ? "s" : ""}
                  </summary>
                  <ul className="p-3 space-y-1">
                    {validationResult.recentCommits.map((c) => (
                      <li key={c.hash} className="flex gap-2 text-xs">
                        <code className="text-accent shrink-0">{c.hash}</code>
                        <span className="text-muted truncate">{c.message}</span>
                      </li>
                    ))}
                  </ul>
                </details>
              )}

              {/* Plan docs found */}
              {validationResult.planDocsFound.length > 0 && (
                <details className="border border-border rounded">
                  <summary className="px-3 py-2 cursor-pointer bg-hover-subtle hover:bg-border rounded text-xs font-medium select-none">
                    {validationResult.planDocsFound.length} plan doc{validationResult.planDocsFound.length > 1 ? "s" : ""} in .planning/
                  </summary>
                  <ul className="p-3 space-y-1">
                    {validationResult.planDocsFound.map((f) => (
                      <li key={f} className="text-xs text-muted font-mono">{f}</li>
                    ))}
                  </ul>
                </details>
              )}

              {/* Recently changed files */}
              {validationResult.recentlyChangedFiles.length > 0 && (
                <details className="border border-border rounded">
                  <summary className="px-3 py-2 cursor-pointer bg-hover-subtle hover:bg-border rounded text-xs font-medium select-none">
                    {validationResult.recentlyChangedFiles.length} file{validationResult.recentlyChangedFiles.length > 1 ? "s" : ""} changed in repo
                  </summary>
                  <ul className="p-3 space-y-1">
                    {validationResult.recentlyChangedFiles.map((f) => (
                      <li key={f} className="text-xs text-muted font-mono">{f}</li>
                    ))}
                  </ul>
                </details>
              )}

              {/* Missing files */}
              {validationResult.planFilesMissing.length > 0 && (
                <details className="border border-border rounded">
                  <summary className="px-3 py-2 cursor-pointer bg-hover-subtle hover:bg-border rounded text-xs font-medium select-none text-warning">
                    {validationResult.planFilesMissing.length} referenced file{validationResult.planFilesMissing.length > 1 ? "s" : ""} not yet created
                  </summary>
                  <ul className="p-3 space-y-1">
                    {validationResult.planFilesMissing.map((f) => (
                      <li key={f} className="text-xs text-muted font-mono">{f}</li>
                    ))}
                  </ul>
                </details>
              )}
            </div>
          )}
        </div>
      )}
    </div>
  )
}
