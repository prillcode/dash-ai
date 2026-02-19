import { useForm } from "react-hook-form"
import { zodResolver } from "@hookform/resolvers/zod"
import { z } from "zod"
import { Button, FormField } from "../ui"
import type { Persona, PersonaInput } from "../../types/persona"

const personaSchema = z.object({
  name: z.string().min(1, "Name is required"),
  description: z.string().optional(),
  systemPrompt: z.string().min(1, "System prompt is required"),
  model: z.string().optional(),
  allowedTools: z.array(z.string()).optional(),
  contextFiles: z.array(z.string()).optional(),
  tags: z.array(z.string()).optional(),
})

interface PersonaFormProps {
  initialData?: Persona
  onSubmit: (data: PersonaInput) => void
  isLoading?: boolean
}

export function PersonaForm({ initialData, onSubmit, isLoading }: PersonaFormProps) {
  const {
    register,
    handleSubmit,
    formState: { errors },
  } = useForm<PersonaInput>({
    resolver: zodResolver(personaSchema),
    defaultValues: initialData
      ? {
          name: initialData.name,
          description: initialData.description,
          systemPrompt: initialData.systemPrompt,
          model: initialData.model,
          allowedTools: initialData.allowedTools,
          contextFiles: initialData.contextFiles,
          tags: initialData.tags,
        }
      : {
          model: "claude-sonnet-4-5",
        },
  })

  return (
    <form onSubmit={handleSubmit(onSubmit)} className="space-y-4">
      <FormField
        label="Name"
        register={register("name")}
        error={errors.name}
        placeholder="e.g., Implementer"
      />
      <FormField
        label="Description"
        register={register("description")}
        error={errors.description}
        placeholder="Brief description of this persona"
      />
      <FormField
        label="System Prompt"
        type="textarea"
        register={register("systemPrompt")}
        error={errors.systemPrompt}
        placeholder="You are a senior engineer..."
        rows={6}
      />
      <FormField
        label="Model"
        register={register("model")}
        error={errors.model}
        placeholder="claude-sonnet-4-5"
      />
      <FormField
        label="Allowed Tools (comma-separated)"
        register={register("allowedTools", {
          setValueAs: (v) =>
            v
              ? String(v)
                  .split(",")
                  .map((s) => s.trim())
                  .filter(Boolean)
              : [],
        })}
        error={errors.allowedTools}
        placeholder="bash, read, write, edit"
      />
      <FormField
        label="Context Files (comma-separated)"
        register={register("contextFiles", {
          setValueAs: (v) =>
            v
              ? String(v)
                  .split(",")
                  .map((s) => s.trim())
                  .filter(Boolean)
              : [],
        })}
        error={errors.contextFiles}
        placeholder="ARCHITECTURE.md, src/tsconfig.json"
      />
      <FormField
        label="Tags (comma-separated)"
        register={register("tags", {
          setValueAs: (v) =>
            v
              ? String(v)
                  .split(",")
                  .map((s) => s.trim())
                  .filter(Boolean)
              : [],
        })}
        error={errors.tags}
        placeholder="typescript, backend"
      />
      <div className="flex justify-end gap-2">
        <Button type="submit" disabled={isLoading}>
          {isLoading ? "Saving..." : initialData ? "Update" : "Create"}
        </Button>
      </div>
    </form>
  )
}
