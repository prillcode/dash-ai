import { ButtonHTMLAttributes, forwardRef } from "react"

type ButtonVariant = "default" | "primary" | "secondary" | "ghost" | "destructive" | "success"

interface ButtonProps extends ButtonHTMLAttributes<HTMLButtonElement> {
  variant?: ButtonVariant
}

const variantStyles: Record<ButtonVariant, string> = {
  default:     "bg-accent text-bg hover:bg-accent-hover",
  primary:     "bg-accent text-bg hover:bg-accent-hover",
  secondary:   "bg-hover-subtle text-text hover:bg-border",
  ghost:       "bg-transparent text-muted hover:bg-hover-subtle hover:text-text",
  destructive: "bg-danger text-white hover:bg-danger-hover",
  success:     "bg-success text-bg hover:bg-success-hover",
}

export const Button = forwardRef<HTMLButtonElement, ButtonProps>(
  ({ variant = "default", className = "", ...props }, ref) => {
    return (
      <button
        ref={ref}
        className={`px-4 py-2 rounded-md font-medium transition-colors disabled:opacity-50 disabled:cursor-not-allowed ${variantStyles[variant]} ${className}`}
        {...props}
      />
    )
  }
)

Button.displayName = "Button"
