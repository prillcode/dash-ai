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
      <div className="p-4 bg-red-50 text-red-600 rounded-lg">
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
              className="border border-gray-200 rounded-lg p-4 hover:shadow-sm transition-shadow"
            >
              <div className="flex items-start justify-between">
                <div className="space-y-1 flex-1">
                  <div className="flex items-center gap-2">
                    <h3 className="font-semibold text-lg">{project.name}</h3>
                    <span
                      className={`px-2 py-1 text-xs rounded-full ${project.isActive
                          ? "bg-green-100 text-green-800"
                          : "bg-gray-100 text-gray-800"
                        }`}
                    >
                      {project.isActive ? "Active" : "Inactive"}
                    </span>
                  </div>
                  <div className="text-sm text-gray-600">
                    <code className="bg-gray-100 px-1 rounded">{project.resolvedPath}</code>
                  </div>
                  {project.description && (
                    <p className="text-gray-700 mt-2">{project.description}</p>
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