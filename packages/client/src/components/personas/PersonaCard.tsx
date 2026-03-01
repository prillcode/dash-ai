import { useNavigate } from "react-router-dom"
import type { Persona } from "../../types/persona"
import { Badge } from "../ui"

interface PersonaCardProps {
  persona: Persona
  onToggle: (id: string) => void
  onDelete: (id: string) => void
}

export function PersonaCard({ persona, onToggle, onDelete }: PersonaCardProps) {
  const navigate = useNavigate()

  return (
    <div className="card p-4 hover:border-accent/40 transition-colors">
      <div className="flex items-start justify-between">
        <div className="flex-1">
          <div className="flex items-center gap-2">
            <h3 className="font-semibold text-lg">{persona.name}</h3>
            <Badge color={persona.isActive ? "green" : "gray"}>
              {persona.isActive ? "Active" : "Inactive"}
            </Badge>
          </div>
          <p className="text-sm text-muted mt-1 line-clamp-2">{persona.description}</p>
          <div className="flex items-center gap-2 mt-2">
            <Badge color="blue">{persona.model}</Badge>
            {persona.tags.slice(0, 3).map((tag) => (
              <Badge key={tag} color="purple">{tag}</Badge>
            ))}
          </div>
        </div>
        <div className="flex items-center gap-2 ml-4">
          <button
            onClick={() => navigate(`/personas/${persona.id}/edit`)}
            className="text-accent hover:text-accent-hover text-sm"
          >
            Edit
          </button>
          <button
            onClick={() => onToggle(persona.id)}
            className="text-muted hover:text-text text-sm"
          >
            {persona.isActive ? "Disable" : "Enable"}
          </button>
          <button
            onClick={() => onDelete(persona.id)}
            className="text-danger hover:text-danger-hover text-sm"
          >
            Delete
          </button>
        </div>
      </div>
    </div>
  )
}
