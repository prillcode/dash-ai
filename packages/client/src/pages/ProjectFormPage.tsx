import { useParams, useNavigate } from "react-router-dom"
import { useProject, useCreateProject, useUpdateProject } from "../api/projects"
import { ProjectForm } from "../components/projects"
import { Spinner } from "../components/ui"

export function ProjectFormPage() {
  const { id } = useParams<{ id: string }>()
  const navigate = useNavigate()
  const isEdit = !!id

  const queryId = id || ''
  const { data: existing, isLoading: loadingExisting } = useProject(queryId, isEdit)
  const createMutation = useCreateProject()
  const updateMutation = useUpdateProject()

  const isLoading = loadingExisting || createMutation.isPending || updateMutation.isPending
  const error = createMutation.error || updateMutation.error

  const handleSubmit = (data: any) => {
    if (isEdit) {
      updateMutation.mutate(
        { id: id!, ...data },
        { onSuccess: () => navigate("/projects") }
      )
    } else {
      createMutation.mutate(data, { onSuccess: () => navigate("/projects") })
    }
  }

  if (isEdit && loadingExisting) {
    return (
      <div className="flex items-center justify-center h-64">
        <Spinner size="lg" />
      </div>
    )
  }

  return (
    <div className="space-y-6">
      <h1 className="text-2xl font-bold">{isEdit ? "Edit Project" : "New Project"}</h1>
      {error && (
        <div className="p-4 bg-red-50 text-red-600 rounded-lg">
          Error: {error.message}
        </div>
      )}
      <ProjectForm
        initialData={existing}
        onSubmit={handleSubmit}
        isLoading={isLoading}
      />
    </div>
  )
}