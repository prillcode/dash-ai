import { marked } from "marked"
import { usePlanDoc } from "../../api/tasks"
import { Spinner } from "../ui"

interface PlanDocViewerProps {
  taskId: string
  file: "BRIEF.md" | "ROADMAP.md" | "EXECUTION.md" | "ISSUES.md"
  title: string
}

export function PlanDocViewer({ taskId, file, title }: PlanDocViewerProps) {
  const { data, isLoading, error } = usePlanDoc(taskId, file, true)

  if (isLoading) {
    return (
      <div className="flex items-center gap-2 text-sm text-muted">
        <Spinner size="sm" /> Loading {file}...
      </div>
    )
  }

  if (error || !data) {
    return (
      <p className="text-sm text-muted italic">{file} not yet generated.</p>
    )
  }

  const html = marked.parse(data.content, { async: false }) as string

  return (
    <details className="border border-border rounded">
      <summary className="px-3 py-2 cursor-pointer font-medium text-sm bg-hover-subtle hover:bg-border rounded select-none">
        {title}
      </summary>
      <div
        className="prose prose-sm max-w-none p-4 text-sm"
        dangerouslySetInnerHTML={{ __html: html }}
      />
    </details>
  )
}
