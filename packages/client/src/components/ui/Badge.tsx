import { HTMLAttributes } from "react"

type BadgeColor = "gray" | "blue" | "green" | "yellow" | "red" | "purple"

interface BadgeProps extends HTMLAttributes<HTMLSpanElement> {
  color?: BadgeColor
}

const colorStyles: Record<BadgeColor, string> = {
  gray:   "bg-hover-subtle text-muted border border-border",
  blue:   "bg-accent-bg text-accent border border-accent/30",
  green:  "bg-success-bg text-success border border-success/30",
  yellow: "bg-warn-bg text-warn border border-warn/30",
  red:    "bg-danger-bg text-danger border border-danger/30",
  purple: "bg-purple-bg text-purple border border-purple/30",
}

export function Badge({ color = "gray", className = "", ...props }: BadgeProps) {
  return (
    <span
      className={`inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium ${colorStyles[color]} ${className}`}
      {...props}
    />
  )
}
