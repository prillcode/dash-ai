import { HTMLAttributes } from "react"

interface SpinnerProps extends HTMLAttributes<HTMLDivElement> {
  size?: "sm" | "md" | "lg"
}

const sizeClasses = {
  sm: "w-4 h-4",
  md: "w-6 h-6",
  lg: "w-8 h-8",
}

export function Spinner({ size = "md", className = "", ...props }: SpinnerProps) {
  return (
    <div
      className={`animate-spin rounded-full border-2 border-border border-t-accent ${sizeClasses[size]} ${className}`}
      {...props}
    />
  )
}
