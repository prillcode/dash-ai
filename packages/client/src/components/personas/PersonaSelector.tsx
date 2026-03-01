import { usePersonas } from "../../api/personas"
import type { Persona } from "../../types/persona"

interface PersonaSelectorProps {
  value?: string
  onChange: (personaId: string, personaName: string) => void
  placeholder?: string
  className?: string
  filterType?: string
}

export function PersonaSelector({
  value,
  onChange,
  placeholder = "Select a persona",
  className = "",
  filterType,
}: PersonaSelectorProps) {
  const { data: allPersonas, isLoading } = usePersonas(true)

  const personas = filterType
    ? allPersonas?.filter((p: Persona) =>
        filterType === "coder"
          ? p.personaType === "coder" || p.personaType === "custom"
          : p.personaType === filterType
      )
    : allPersonas

  if (isLoading) {
    return (
      <select disabled className={`form-input w-full px-3 py-2 opacity-50 ${className}`}>
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
      className={`form-input w-full px-3 py-2 ${className}`}
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
