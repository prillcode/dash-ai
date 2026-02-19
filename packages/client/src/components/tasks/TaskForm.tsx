import { useForm } from "react-hook-form"
import { zodResolver } from "@hookform/resolvers/zod"
import { z } from "zod"
import { Button, FormField } from "../ui"
import { PersonaSelector } from "../personas"
import type { TaskInput } from "../../types/task"

const taskSchema = z.object({
  title: z.string().min(1, "Title is required"),
  description: z.string().min(1, "Description is required"),
  personaId: z.string().min(1, "Persona is required"),
  repoPath: z.string().min(1, "Repository path is required"),
  targetFiles: z.array(z.string()).optional(),
  priority: z.number().min(1).max(5).optional(),
})

interface TaskFormProps {
  initialData?: Partial<TaskInput>
  onSubmit: (data: TaskInput) => void
  isLoading?: boolean
}

export function TaskForm({ initialData, onSubmit, isLoading }: TaskFormProps) {
  const {
    register,
    handleSubmit,
    setValue,
    formState: { errors },
  } = useForm<TaskInput>({
    resolver: zodResolver(taskSchema),
    defaultValues: {
      title: initialData?.title || "",
      description: initialData?.description || "",
      personaId: initialData?.personaId || "",
      repoPath: initialData?.repoPath || "",
      targetFiles: initialData?.targetFiles || [],
      priority: initialData?.priority ?? 3,
    },
  })

  return (
    <form onSubmit={handleSubmit(onSubmit)} className="space-y-4">
      <FormField
        label="Title"
        register={register("title")}
        error={errors.title}
        placeholder="Brief task title"
      />
      <FormField
        label="Description"
        type="textarea"
        register={register("description")}
        error={errors.description}
        placeholder="Detailed description of what the agent should do..."
        rows={6}
      />
      <div className="space-y-1">
        <label className="block text-sm font-medium text-gray-700">Persona</label>
        <PersonaSelector
          value={initialData?.personaId}
          onChange={(id, _name) => setValue("personaId", id)}
        />
        {errors.personaId && <p className="text-sm text-red-600">{errors.personaId.message}</p>}
      </div>
      <FormField
        label="Repository Path"
        register={register("repoPath")}
        error={errors.repoPath}
        placeholder="/home/user/projects/my-app"
      />
      <FormField
        label="Target Files (comma-separated)"
        register={register("targetFiles", {
          setValueAs: (v) =>
            v
              ? String(v)
                  .split(",")
                  .map((s) => s.trim())
                  .filter(Boolean)
              : [],
        })}
        error={errors.targetFiles}
        placeholder="src/index.ts, src/utils.ts"
      />
      <FormField
        label="Priority (1-5, 1 is highest)"
        type="number"
        register={register("priority", { valueAsNumber: true })}
        error={errors.priority}
        step="1"
      />
      <div className="flex justify-end gap-2">
        <Button type="submit" disabled={isLoading}>
          {isLoading ? "Creating..." : "Create Task"}
        </Button>
      </div>
    </form>
  )
}
