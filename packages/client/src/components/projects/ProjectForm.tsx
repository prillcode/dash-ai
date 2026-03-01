import { useEffect } from "react"
import { useForm } from "react-hook-form"
import { zodResolver } from "@hookform/resolvers/zod"
import { z } from "zod"
import { Button, FormField } from "../ui"
import { useValidatePath } from "../../api/projects"
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

  const watchedPath = watch("path")
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
    if (validating) return <span className="text-gray-500">Checking path…</span>
    if (validationError) return <span className="text-red-600">Could not validate path</span>
    if (validation) {
      if (validation.valid) {
        return (
          <span className="text-green-700">
            ✓ {validation.resolvedPath}
          </span>
        )
      } else {
        return <span className="text-red-600">{validation.error}</span>
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
        <label className="block text-sm font-medium text-gray-700">Path</label>
        <input
          {...register("path")}
          placeholder="~ /home/user/projects/my-app"
          className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500"
        />
        <div className="text-sm mt-1 min-h-[1.5rem]">
          {validationMessage()}
        </div>
        {errors.path && <p className="text-sm text-red-600 mt-1">{errors.path.message}</p>}
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