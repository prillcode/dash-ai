import { useForm } from "react-hook-form"
import { zodResolver } from "@hookform/resolvers/zod"
import { z } from "zod"
import { useIterateCoding } from "../../api/tasks"
import { Button } from "../ui"

const schema = z.object({
  feedback: z.string().min(10, "Please provide at least 10 characters of feedback"),
})

type FormData = z.infer<typeof schema>

interface IterateCodingFormProps {
  taskId: string
  onCancel: () => void
  onSuccess: () => void
}

export function IterateCodingForm({ taskId, onCancel, onSuccess }: IterateCodingFormProps) {
  const iterateCoding = useIterateCoding()
  const {
    register,
    handleSubmit,
    formState: { errors },
  } = useForm<FormData>({ resolver: zodResolver(schema) })

  const onSubmit = async (data: FormData) => {
    await iterateCoding.mutateAsync({ taskId, feedback: data.feedback })
    onSuccess()
  }

  return (
    <form onSubmit={handleSubmit(onSubmit)} className="space-y-3 pt-3 border-t border-border">
      <div>
        <label className="block text-sm font-medium text-muted mb-1">
          Feedback for the coding follow-up
        </label>
        <textarea
          {...register("feedback")}
          rows={4}
          placeholder="Describe what to continue, fix, or adjust in the existing repo changes..."
          className="form-input w-full px-3 py-2 text-sm"
        />
        {errors.feedback && (
          <p className="text-xs text-danger mt-1">{errors.feedback.message}</p>
        )}
      </div>
      <div className="flex gap-2">
        <Button type="submit" variant="primary" disabled={iterateCoding.isPending}>
          {iterateCoding.isPending ? "Queueing..." : "Queue Follow-up Coding"}
        </Button>
        <Button type="button" variant="ghost" onClick={onCancel}>
          Cancel
        </Button>
      </div>
      {iterateCoding.isError && (
        <p className="text-sm text-danger">
          Error: {(iterateCoding.error as Error)?.message || "Failed to queue coding follow-up"}
        </p>
      )}
    </form>
  )
}
