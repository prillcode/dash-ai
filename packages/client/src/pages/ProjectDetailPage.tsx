import { useNavigate, useParams } from "react-router-dom"
import { ApiError } from "../api/client"
import { useProject, useAgentMd, useGenerateAgentMd } from "../api/projects"
import { useSettings } from "../api/settings"
import { AgentMdViewer } from "../components/projects"
import { Button, Spinner } from "../components/ui"

export function ProjectDetailPage() {
  const { id } = useParams<{ id: string }>()
  const navigate = useNavigate()
  const { data: settings } = useSettings()
  const { data: project, isLoading, error } = useProject(id!, !!id)
  const {
    data: agentMd,
    isLoading: loadingAgentMd,
    error: agentMdError,
  } = useAgentMd(id!, !!id)
  const generateMutation = useGenerateAgentMd()

  const handleGenerate = (overwrite = false) => {
    if (!id) return
    generateMutation.mutate(
      { id, overwrite },
      {
        onError: (err) => {
          if (
            err instanceof ApiError &&
            err.status === 409 &&
            (!settings?.confirmDestructiveActions ||
              window.confirm("Existing Agent.md will be overwritten. Continue?"))
          ) {
            generateMutation.mutate({ id, overwrite: true })
          }
        },
      }
    )
  }

  if (isLoading) {
    return (
      <div className="flex items-center justify-center h-64">
        <Spinner size="lg" />
      </div>
    )
  }

  if (error || !project) {
    return (
      <div className="error-banner">
        Error loading project: {error?.message || "Project not found"}
      </div>
    )
  }

  const viewerError = agentMdError instanceof ApiError && agentMdError.status === 404
    ? null
    : (agentMdError as Error | null)

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between gap-4">
        <div className="flex items-center gap-3">
          <Button variant="ghost" onClick={() => navigate("/projects")}>
            ← Back
          </Button>
          <div>
            <h1 className="text-2xl font-bold">{project.name}</h1>
            <p className="text-sm text-muted mt-1">{project.resolvedPath}</p>
          </div>
        </div>
        <div className="flex items-center gap-2">
          <Button variant="secondary" onClick={() => navigate(`/tasks/new?projectId=${project.id}`)}>
            + Task
          </Button>
          <Button variant="ghost" onClick={() => navigate(`/projects/${project.id}/edit`)}>
            Edit
          </Button>
        </div>
      </div>

      {generateMutation.error && !(generateMutation.error instanceof ApiError && generateMutation.error.status === 409) && (
        <div className="error-banner">Failed to generate Agent.md: {generateMutation.error.message}</div>
      )}

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        <div className="lg:col-span-2 space-y-6">
          <div className="card p-4">
            <h2 className="font-semibold mb-3">Agent.md</h2>
            <AgentMdViewer
              data={agentMd}
              isLoading={loadingAgentMd}
              error={viewerError}
              onGenerate={() => handleGenerate()}
              isGenerating={generateMutation.isPending}
            />
          </div>
        </div>

        <div className="space-y-4">
          <div className="card p-4">
            <h2 className="font-semibold mb-3">Details</h2>
            <dl className="space-y-2 text-sm">
              <div>
                <dt className="text-muted">Path</dt>
                <dd className="code-inline">{project.resolvedPath}</dd>
              </div>
              {project.description && (
                <div>
                  <dt className="text-muted">Description</dt>
                  <dd className="whitespace-pre-wrap">{project.description}</dd>
                </div>
              )}
              <div>
                <dt className="text-muted">Created</dt>
                <dd>{new Date(project.createdAt).toLocaleString()}</dd>
              </div>
              <div>
                <dt className="text-muted">Updated</dt>
                <dd>{new Date(project.updatedAt).toLocaleString()}</dd>
              </div>
            </dl>
          </div>
        </div>
      </div>
    </div>
  )
}
