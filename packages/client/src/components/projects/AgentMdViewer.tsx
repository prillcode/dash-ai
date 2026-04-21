import { marked } from "marked"
import { Spinner, Button } from "../ui"
import type { AgentMdSnapshot } from "../../types/project"

interface AgentMdViewerProps {
  data?: AgentMdSnapshot
  isLoading?: boolean
  error?: Error | null
  onGenerate: () => void
  isGenerating?: boolean
}

export function AgentMdViewer({
  data,
  isLoading,
  error,
  onGenerate,
  isGenerating,
}: AgentMdViewerProps) {
  if (isLoading) {
    return (
      <div className="flex items-center gap-2 text-sm text-muted">
        <Spinner size="sm" /> Loading Agent.md...
      </div>
    )
  }

  if (error) {
    return <p className="text-sm text-danger">Failed to load Agent.md: {error.message}</p>
  }

  if (!data?.exists || !data.content) {
    return (
      <div className="space-y-3">
        <p className="text-sm text-muted italic">No Agent.md found for this project yet.</p>
        <Button onClick={onGenerate} disabled={isGenerating}>
          {isGenerating ? "Generating..." : "Generate Agent.md"}
        </Button>
      </div>
    )
  }

  const html = marked.parse(data.content, { async: false }) as string

  return (
    <div className="space-y-3">
      <div className="flex items-center justify-between gap-3">
        <div className="text-sm text-muted">
          {data.updatedAt ? `Last updated ${new Date(data.updatedAt).toLocaleString()}` : "Agent.md present"}
        </div>
        <Button variant="secondary" onClick={onGenerate} disabled={isGenerating}>
          {isGenerating ? "Generating..." : "Re-generate Agent.md"}
        </Button>
      </div>
      <div className="max-h-[32rem] overflow-auto rounded border border-border bg-hover-subtle/20">
        <div
          className="prose prose-sm max-w-none p-4 text-sm"
          dangerouslySetInnerHTML={{ __html: html }}
        />
      </div>
    </div>
  )
}
