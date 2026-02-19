import { ReactNode } from "react"
import { UseFormRegisterReturn } from "react-hook-form"

interface FormFieldProps {
  label: string
  error?: unknown
  register?: UseFormRegisterReturn
  type?: "text" | "textarea" | "number" | "select"
  placeholder?: string
  children?: ReactNode
  rows?: number
  step?: string
}

export function FormField({
  label,
  error,
  register,
  type = "text",
  placeholder,
  children,
  rows = 4,
  step,
}: FormFieldProps) {
  const inputClasses = `w-full px-3 py-2 border rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500 ${
    error ? "border-red-500" : "border-gray-300"
  }`

  return (
    <div className="space-y-1">
      <label className="block text-sm font-medium text-gray-700">{label}</label>
      {type === "textarea" ? (
        <textarea
          {...register}
          placeholder={placeholder}
          rows={rows}
          className={inputClasses}
        />
      ) : type === "select" ? (
        <select {...register} className={inputClasses}>
          {children}
        </select>
      ) : (
        <input
          {...register}
          type={type}
          placeholder={placeholder}
          step={step}
          className={inputClasses}
        />
      )}
      {error && typeof error === 'object' && 'message' in error ? (
        <p className="text-sm text-red-600">{String((error as { message: unknown }).message)}</p>
      ) : null}
    </div>
  )
}
