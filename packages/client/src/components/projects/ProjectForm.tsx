import { useEffect } from "react"
import { useForm } from "react-hook-form"
import { zodResolver } from "@hookform/resolvers/zod"
import { z } from "zod"
import { Button, FormField } from "../ui"
import { useValidatePath } from "../../api/projects"
import { useSettings } from "../../api/settings"
import type { Project, ProjectInput } from "../../types/project"

const projectSchema = z.object({
  name: z.string().min(1, "Name is required"),
  description: z.string().optional(),
  path: z.string().min(1, "Path is required"),
})

interface ProjectFormProps {
  initialData?: Project
  onSubmit: (data: ProjectInput) => void
  isLoading?: boolean
}

function suggestContainerProjectPath(input: string | undefined, projectsRoot: string): string | null {
  if (!input) return null

  const trimmed = input.trim()
  if (!trimmed) return null
  if (trimmed.startsWith(`${projectsRoot}/`)) return null

  const normalizedRoot = projectsRoot.replace(/\/$/, "")
  const homeDevMatch = trimmed.match(/^~\/dev\/(.+)$/)
  if (homeDevMatch) return `${normalizedRoot}/${homeDevMatch[1]}`

  const absoluteDevMatch = trimmed.match(/^\/home\/[^/]+\/dev\/(.+)$/)
  if (absoluteDevMatch) return `${normalizedRoot}/${absoluteDevMatch[1]}`

  return null
}

export function ProjectForm({ initialData, onSubmit, isLoading }: ProjectFormProps) {
  const {
    register,
    handleSubmit,
    watch,
    setValue,
    formState: { errors },
  } = useForm<ProjectInput>({
    resolver: zodResolver(projectSchema),
    defaultValues: initialData
      ? {
          name: initialData.name,
          description: initialData.description,
          path: initialData.path,
        }
      : {
          description: "",
        },
  })

  const { data: settings } = useSettings()
  const deploymentMode = settings?.deploymentMode
  const projectsRoot = settings?.projectsRoot || "/projects"
  const isDockerDeployment = deploymentMode === "docker"

  const watchedPath = watch("path")
  const suggestedContainerPath = suggestContainerProjectPath(watchedPath, projectsRoot)
  const {
    data: validation,
    isLoading: validating,
    error: validationError,
  } = useValidatePath(watchedPath, watchedPath?.length > 0)

  useEffect(() => {
    if (initialData) {
      setValue("name", initialData.name)
      setValue("description", initialData.description)
      setValue("path", initialData.path)
    }
  }, [initialData, setValue])

  const validationMessage = () => {
    if (!watchedPath || watchedPath.length === 0) return null
    if (validating) return <span className="text-muted">Checking path…</span>
    if (validationError) return <span className="text-danger">Could not validate path</span>
    if (validation) {
      if (validation.valid) {
        return <span className="text-success">✓ {validation.resolvedPath}</span>
      } else {
        return <span className="text-danger">{validation.error}</span>
      }
    }
    return null
  }

  return (
    <form onSubmit={handleSubmit(onSubmit)} className="space-y-4">
      <FormField
        label="Name"
        register={register("name")}
        error={errors.name}
        placeholder="My Awesome Project"
      />
      <FormField
        label="Description (optional)"
        register={register("description")}
        error={errors.description}
        placeholder="Brief description of the project"
        type="textarea"
        rows={4}
      />
      <div className="space-y-1">
        <label className="block text-sm font-medium text-muted">Path</label>
        <input
          {...register("path")}
          placeholder={isDockerDeployment
            ? `Docker: ${projectsRoot}/my-repo`
            : `Native: ~/dev/my-repo${settings?.projectsRoot ? `  •  Docker: ${projectsRoot}/my-repo` : ""}`}
          className="form-input w-full px-3 py-2"
        />
        <div className="text-xs text-muted mt-1 space-y-1">
          <p>Use a filesystem path the Dash-AI server can access.</p>
          {isDockerDeployment ? (
            <>
              <p>Deployment mode: <span className="code-inline">docker</span></p>
              <p>Projects root: <span className="code-inline">{projectsRoot}</span></p>
              <p>Enter container paths like <span className="code-inline">{projectsRoot}/my-repo</span>.</p>
            </>
          ) : (
            <>
              <p>Native/web mode: <span className="code-inline">~/dev/my-repo</span></p>
              {settings?.projectsRoot && (
                <p>Docker mode: <span className="code-inline">{projectsRoot}/my-repo</span> (maps to host <span className="code-inline">~/dev/my-repo</span>)</p>
              )}
            </>
          )}
          {suggestedContainerPath && (
            <p>
              Docker suggestion: <span className="code-inline">{suggestedContainerPath}</span>{" "}
              <button
                type="button"
                className="text-accent hover:underline"
                onClick={() => setValue("path", suggestedContainerPath, { shouldDirty: true, shouldValidate: true })}
              >
                Use this path
              </button>
            </p>
          )}
        </div>
        <div className="text-sm mt-1 min-h-[1.5rem]">
          {validationMessage()}
        </div>
        {errors.path && <p className="text-sm text-danger mt-1">{errors.path.message}</p>}
      </div>
      <div className="flex justify-end gap-2">
        <Button
          type="submit"
          disabled={isLoading || (validation && !validation.valid) || validating}
        >
          {isLoading ? "Saving..." : initialData ? "Update" : "Create"}
        </Button>
      </div>
    </form>
  )
}
