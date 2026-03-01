import { useForm } from "react-hook-form"
import { zodResolver } from "@hookform/resolvers/zod"
import { z } from "zod"
import { useIteratePlan } from "../../api/tasks"
import { Button } from "../ui"

const schema = z.object({
  feedback: z.string().min(10, "Please provide at least 10 characters of feedback"),
})

type FormData = z.infer<typeof schema>

interface IteratePlanFormProps {
  taskId: string
  onCancel: () => void
  onSuccess: () => void
}

export function IteratePlanForm({ taskId, onCancel, onSuccess }: IteratePlanFormProps) {
  const iteratePlan = useIteratePlan()
  const {
    register,
    handleSubmit,
    formState: { errors },
  } = useForm<FormData>({ resolver: zodResolver(schema) })

  const onSubmit = async (data: FormData) => {
    await iteratePlan.mutateAsync({ taskId, feedback: data.feedback })
    onSuccess()
  }

  return (
    <form onSubmit={handleSubmit(onSubmit)} className="space-y-3 pt-3 border-t border-border">
      <div>
        <label className="block text-sm font-medium text-muted mb-1">
          Feedback for the AI planner
        </label>
        <textarea
          {...register("feedback")}
          rows={4}
          placeholder="What needs to change in the plan? Be specific about what to add, remove, or rethink..."
          className="form-input w-full px-3 py-2 text-sm"
        />
        {errors.feedback && (
          <p className="text-xs text-danger mt-1">{errors.feedback.message}</p>
        )}
      </div>
      <div className="flex gap-2">
        <Button type="submit" variant="primary" disabled={iteratePlan.isPending}>
          {iteratePlan.isPending ? "Submitting..." : "Submit Feedback"}
        </Button>
        <Button type="button" variant="ghost" onClick={onCancel}>
          Cancel
        </Button>
      </div>
      {iteratePlan.isError && (
        <p className="text-sm text-danger">
          Error: {(iteratePlan.error as Error)?.message || "Failed to submit feedback"}
        </p>
      )}
    </form>
  )
}
