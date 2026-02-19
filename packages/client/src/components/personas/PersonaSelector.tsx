import { usePersonas } from "../../api/personas"
import type { Persona } from "../../types/persona"

interface PersonaSelectorProps {
  value?: string
  onChange: (personaId: string, personaName: string) => void
  placeholder?: string
  className?: string
}

export function PersonaSelector({
  value,
  onChange,
  placeholder = "Select a persona",
  className = "",
}: PersonaSelectorProps) {
  const { data: personas, isLoading } = usePersonas(true)

  if (isLoading) {
    return (
      <select disabled className={`w-full px-3 py-2 border rounded-md bg-gray-50 ${className}`}>
        <option>Loading personas...</option>
      </select>
    )
  }

  return (
    <select
      value={value || ""}
      onChange={(e) => {
        const selected = personas?.find((p: Persona) => p.id === e.target.value)
        if (selected) {
          onChange(selected.id, selected.name)
        }
      }}
      className={`w-full px-3 py-2 border rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500 ${className}`}
    >
      <option value="" disabled>
        {placeholder}
      </option>
      {personas?.map((persona: Persona) => (
        <option key={persona.id} value={persona.id}>
          {persona.name}
        </option>
      ))}
    </select>
  )
}
