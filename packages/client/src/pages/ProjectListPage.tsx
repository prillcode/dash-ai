import { useNavigate } from "react-router-dom"
import { useProjects, useDeleteProject } from "../api/projects"
import { Spinner, EmptyState, Button } from "../components/ui"

export function ProjectListPage() {
  const navigate = useNavigate()
  const { data: projects, isLoading, error } = useProjects(false)
  const deleteProject = useDeleteProject()

  if (isLoading) {
    return (
      <div className="flex items-center justify-center h-64">
        <Spinner size="lg" />
      </div>
    )
  }

  if (error) {
    return (
      <div className="error-banner">
        Error loading projects: {error.message}
      </div>
    )
  }

  const handleDelete = (id: string, name: string) => {
    if (window.confirm(`Delete project "${name}"? This will not delete any files on disk.`)) {
      deleteProject.mutate(id)
    }
  }

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <h1 className="text-2xl font-bold">Projects</h1>
        <Button onClick={() => navigate("/projects/new")}>New Project</Button>
      </div>

      {!projects || projects.length === 0 ? (
        <EmptyState
          heading="No projects yet"
          description="Add your first project to get started"
          action={<Button onClick={() => navigate("/projects/new")}>Add Project</Button>}
        />
      ) : (
        <div className="space-y-4">
          {projects.map((project) => (
            <div
              key={project.id}
              className="card p-4 hover:border-accent/40 transition-colors"
            >
              <div className="flex items-start justify-between">
                <div className="space-y-1 flex-1">
                  <div className="flex items-center gap-2">
                    <h3 className="font-semibold text-lg">{project.name}</h3>
                    <span
                      className={`pill ${project.isActive ? "pill-active" : "pill-inactive"}`}
                    >
                      {project.isActive ? "Active" : "Inactive"}
                    </span>
                  </div>
                  <div className="text-sm">
                    <span className="code-inline">{project.resolvedPath}</span>
                  </div>
                  {project.description && (
                    <p className="text-muted mt-2">{project.description}</p>
                  )}
                </div>
                <div className="flex items-center gap-2">
                  <Button
                    variant="ghost"
                    onClick={() => navigate(`/projects/${project.id}/edit`)}
                  >
                    Edit
                  </Button>
                  <Button
                    variant="destructive"
                    onClick={() => handleDelete(project.id, project.name)}
                    disabled={deleteProject.isPending}
                  >
                    {deleteProject.isPending ? "Deleting..." : "Delete"}
                  </Button>
                </div>
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  )
}