import { ReactNode } from "react"

interface EmptyStateProps {
  icon?: ReactNode
  heading: string
  description?: string
  action?: ReactNode
}

export function EmptyState({ icon, heading, description, action }: EmptyStateProps) {
  return (
    <div className="flex flex-col items-center justify-center py-12 text-center">
      {icon && <div className="text-subtle mb-4">{icon}</div>}
      <h3 className="text-lg font-medium text-text">{heading}</h3>
      {description && <p className="mt-1 text-sm text-muted">{description}</p>}
      {action && <div className="mt-4">{action}</div>}
    </div>
  )
}
