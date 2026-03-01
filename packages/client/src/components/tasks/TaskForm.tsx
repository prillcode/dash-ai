import { useEffect, useState } from "react"
import { useForm } from "react-hook-form"
import { zodResolver } from "@hookform/resolvers/zod"
import { z } from "zod"
import { marked } from "marked"
import { Button, FormField } from "../ui"
import { PersonaSelector } from "../personas"
import { ProjectSelector } from "../projects"
import type { TaskInput } from "../../types/task"

interface MarkdownPreviewProps {
  content: string
}

function MarkdownPreview({ content }: MarkdownPreviewProps) {
  const [html, setHtml] = useState("")

  useEffect(() => {
    const timer = setTimeout(() => {
      if (!content.trim()) {
        setHtml("<p class='text-gray-400 italic'>Preview will appear here</p>")
        return
      }
      
      try {
        const parsed = marked.parse(content, {
          async: false,
          gfm: true,
          breaks: true,
        }) as string
        setHtml(parsed)
      } catch (err: any) {
        console.error("Markdown parse error:", err)
        setHtml(`<p class="text-red-600">Error rendering markdown: ${err.message}</p>`)
      }
    }, 300)

    return () => clearTimeout(timer)
  }, [content])

  return <div className="prose prose-sm max-w-none" dangerouslySetInnerHTML={{ __html: html }} />
}

const taskSchema = z.object({
  identifier: z.string().optional(),
  title: z.string().min(1, "Title is required"),
  description: z.string().min(1, "Description is required"),
  codingPersonaId: z.string().min(1, "Coding persona is required"),
  planningPersonaId: z.string().optional(),
  projectId: z.string().min(1, "Project is required"),
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
    watch,
    setValue,
    formState: { errors },
  } = useForm<TaskInput>({
    resolver: zodResolver(taskSchema),
    defaultValues: {
      identifier: initialData?.identifier || "",
      title: initialData?.title || "",
      description: initialData?.description || "",
      codingPersonaId: initialData?.codingPersonaId || "",
      planningPersonaId: initialData?.planningPersonaId || "",
      projectId: initialData?.projectId || "",
      targetFiles: initialData?.targetFiles || [],
      priority: initialData?.priority ?? 3,
    },
  })

  const [descriptionPreview, setDescriptionPreview] = useState(false)

  return (
    <form onSubmit={handleSubmit(onSubmit)} className="space-y-4">
      <FormField
        label="Identifier (optional)"
        register={register("identifier")}
        error={errors.identifier}
        placeholder="JIRA-123, LEAN-456"
      />
      <FormField
        label="Title"
        register={register("title")}
        error={errors.title}
        placeholder="Brief task title"
      />
      <div className="space-y-1">
        <div className="flex items-center justify-between">
          <label className="block text-sm font-medium text-gray-700">Description</label>
          <button
            type="button"
            onClick={() => setDescriptionPreview(!descriptionPreview)}
            className="text-sm text-blue-600 hover:text-blue-800"
          >
            {descriptionPreview ? "Edit" : "Preview"}
          </button>
        </div>
        {descriptionPreview ? (
          <div className="border border-gray-300 rounded-md p-3 bg-gray-50 min-h-[150px] overflow-auto">
            <MarkdownPreview content={watch("description") ?? ""} />
          </div>
        ) : (
          <textarea
            {...register("description")}
            placeholder="Detailed description of what the agent should do..."
            rows={6}
            className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500"
          />
        )}
        {errors.description && (
          <p className="text-sm text-red-600 mt-1">
            {String((errors.description as { message?: unknown }).message ?? "")}
          </p>
        )}
      </div>
      <div className="space-y-1">
        <label className="block text-sm font-medium text-gray-700">Coding Persona</label>
        <PersonaSelector
          value={watch("codingPersonaId")}
          onChange={(id, _name) => setValue("codingPersonaId", id)}
        />
        {errors.codingPersonaId && <p className="text-sm text-red-600">{errors.codingPersonaId.message}</p>}
      </div>
      <div className="space-y-1">
        <label className="block text-sm font-medium text-gray-700">Planning Persona (optional)</label>
        <PersonaSelector
          value={watch("planningPersonaId")}
          onChange={(id, _name) => setValue("planningPersonaId", id)}
        />
        {errors.planningPersonaId && <p className="text-sm text-red-600">{errors.planningPersonaId.message}</p>}
      </div>
      <div className="space-y-1">
        <label className="block text-sm font-medium text-gray-700">Project</label>
        <ProjectSelector
          value={watch("projectId")}
          onChange={(id, _name, _resolvedPath) => setValue("projectId", id)}
        />
        {errors.projectId && <p className="text-sm text-red-600">{errors.projectId.message}</p>}
      </div>
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
