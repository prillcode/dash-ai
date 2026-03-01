import { useEffect, useState } from "react"
import { useForm } from "react-hook-form"
import { zodResolver } from "@hookform/resolvers/zod"
import { z } from "zod"
import { Button, FormField } from "../ui"
import type { Persona, PersonaInput } from "../../types/persona"
import { PersonaType, PERSONA_PRESETS } from "../../types/persona"
import { useModels } from "../../api/personas"
import { marked } from "marked"

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

const personaSchema = z.object({
  name: z.string().min(1, "Name is required"),
  description: z.string().optional(),
  personaType: z.string().optional().default("custom"),
  systemPrompt: z.string().min(1, "System prompt is required"),
  model: z.string().optional(),
  provider: z.string().optional().default("anthropic"),
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
  const { data: modelsData } = useModels()

  const [descriptionPreview, setDescriptionPreview] = useState(false)
  const [systemPromptPreview, setSystemPromptPreview] = useState(false)

  const {
    register,
    handleSubmit,
    watch,
    setValue,
    reset,
    formState: { errors },
  } = useForm<PersonaInput>({
    resolver: zodResolver(personaSchema),
    defaultValues: initialData
      ? {
          name: initialData.name,
          description: initialData.description,
          personaType: initialData.personaType ?? "custom",
          systemPrompt: initialData.systemPrompt,
          model: initialData.model,
          provider: initialData.provider ?? "anthropic",
          allowedTools: initialData.allowedTools,
          contextFiles: initialData.contextFiles,
          tags: initialData.tags,
        }
      : {
          personaType: "custom",
          model: "claude-sonnet-4-5",
          provider: "anthropic",
          allowedTools: [],
        },
  })

  useEffect(() => {
    if (initialData) {
      reset({
        name: initialData.name,
        description: initialData.description,
        personaType: initialData.personaType ?? "custom",
        systemPrompt: initialData.systemPrompt,
        model: initialData.model,
        provider: initialData.provider ?? "anthropic",
        allowedTools: initialData.allowedTools,
        contextFiles: initialData.contextFiles,
        tags: initialData.tags,
      })
    }
  }, [initialData, reset])

  const currentType = watch("personaType") ?? "custom"

  function handleTypeChange(type: string) {
    setValue("personaType", type)
    if (type === PersonaType.CUSTOM) return

    const preset = PERSONA_PRESETS[type as keyof typeof PERSONA_PRESETS]
    if (!preset) return

    // Auto-fill provider, model, allowedTools from preset
    setValue("provider", preset.provider)
    setValue("model", preset.model)
    setValue("allowedTools", preset.allowedTools)
    // Pre-fill description only if currently empty
    if (!watch("description")) {
      setValue("description", preset.description)
    }
  }

  return (
    <form onSubmit={handleSubmit(onSubmit)} className="space-y-4">
      {/* Persona Type — shown first so it can pre-fill other fields */}
      <div className="space-y-1">
        <label className="block text-sm font-medium text-gray-700">Type</label>
        <select
          value={currentType}
          onChange={(e) => handleTypeChange(e.target.value)}
          className="w-full px-3 py-2 border rounded-md text-sm"
        >
          <option value={PersonaType.PLANNER}>Planner — reads codebase, writes plans (no bash)</option>
          <option value={PersonaType.CODER}>Coder — executes plans, writes code, runs builds</option>
          <option value={PersonaType.REVIEWER}>Reviewer — reviews diffs and output logs (read-only)</option>
          <option value={PersonaType.CUSTOM}>Custom — configure manually</option>
        </select>
        {currentType !== PersonaType.CUSTOM && (
          <p className="text-xs text-gray-500 mt-1">
            Provider, model, and allowed tools have been pre-filled for this type. You can override them below.
          </p>
        )}
      </div>

      <FormField
        label="Name"
        register={register("name")}
        error={errors.name}
        placeholder="e.g., Planner"
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
          <div className="border border-gray-300 rounded-md p-3 bg-gray-50 min-h-[100px] overflow-auto">
            <MarkdownPreview content={watch("description") ?? ""} />
          </div>
        ) : (
          <textarea
            {...register("description")}
            placeholder="Brief description of this persona"
            rows={4}
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
        <div className="flex items-center justify-between">
          <label className="block text-sm font-medium text-gray-700">System Prompt</label>
          <button
            type="button"
            onClick={() => setSystemPromptPreview(!systemPromptPreview)}
            className="text-sm text-blue-600 hover:text-blue-800"
          >
            {systemPromptPreview ? "Edit" : "Preview"}
          </button>
        </div>
        <p className="text-xs text-gray-500 mb-2">Markdown supported (headings, lists, code blocks, etc.)</p>
        {systemPromptPreview ? (
          <div className="border border-gray-300 rounded-md p-3 bg-gray-50 min-h-[300px] overflow-auto">
            <MarkdownPreview content={watch("systemPrompt") ?? ""} />
          </div>
        ) : (
          <textarea
            {...register("systemPrompt")}
            placeholder="You are a senior engineer..."
            rows={12}
            className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500 font-mono text-sm"
          />
        )}
        {errors.systemPrompt && (
          <p className="text-sm text-red-600 mt-1">
            {String((errors.systemPrompt as { message?: unknown }).message ?? "")}
          </p>
        )}
      </div>

      {/* Provider + Model cascading selects */}
      <div className="space-y-1">
        <label className="block text-sm font-medium text-gray-700">Provider</label>
        {modelsData ? (
          <select
            value={watch("provider") ?? "anthropic"}
            onChange={(e) => {
              const newProvider = e.target.value
              setValue("provider", newProvider)
              // Reset model to first model of new provider
              const providerEntry = modelsData.providers.find(p => p.id === newProvider)
              if (providerEntry?.models[0]) setValue("model", providerEntry.models[0].id)
            }}
            className="w-full px-3 py-2 border rounded-md text-sm"
          >
            {modelsData.providers.map(p => (
              <option key={p.id} value={p.id}>{p.name}</option>
            ))}
          </select>
        ) : (
          <select disabled className="w-full px-3 py-2 border rounded-md text-sm text-gray-400">
            <option>Loading providers...</option>
          </select>
        )}
      </div>
      <div className="space-y-1">
        <label className="block text-sm font-medium text-gray-700">Model</label>
        {modelsData ? (
          <select
            value={watch("model") ?? ""}
            onChange={(e) => setValue("model", e.target.value)}
            className="w-full px-3 py-2 border rounded-md text-sm"
          >
            {modelsData.providers
              .find(p => p.id === (watch("provider") ?? "anthropic"))
              ?.models.map(m => (
                <option key={m.id} value={m.id}>
                  {m.name}{m.note ? ` (${m.note})` : ""}
                </option>
              ))}
          </select>
        ) : (
          <select disabled className="w-full px-3 py-2 border rounded-md text-sm text-gray-400">
            <option>Loading models...</option>
          </select>
        )}
      </div>

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
        placeholder="bash, read, write, edit, glob, grep"
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
