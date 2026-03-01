import { useNavigate } from "react-router-dom"
import { usePersonas, useTogglePersona, useDeletePersona } from "../api/personas"
import { PersonaCard } from "../components/personas"
import { Spinner, EmptyState, Button } from "../components/ui"

export function PersonaListPage() {
  const navigate = useNavigate()
  const { data: personas, isLoading, error } = usePersonas(false)
  const togglePersona = useTogglePersona()
  const deletePersona = useDeletePersona()

  const handleToggle = (id: string) => {
    togglePersona.mutate(id)
  }

  const handleDelete = (id: string) => {
    if (confirm("Are you sure you want to delete this persona?")) {
      deletePersona.mutate(id)
    }
  }

  if (isLoading) {
    return (
      <div className="flex items-center justify-center h-64">
        <Spinner size="lg" />
      </div>
    )
  }

  if (error) {
    return (
      <div className="error-banner">
        Error loading personas: {error.message}
      </div>
    )
  }

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <h1 className="text-2xl font-bold">Personas</h1>
        <Button onClick={() => navigate("/personas/new")}>New Persona</Button>
      </div>

      {!personas || personas.length === 0 ? (
        <EmptyState
          heading="No personas found"
          description="Create a persona to define AI agent behavior"
          action={<Button onClick={() => navigate("/personas/new")}>Create Persona</Button>}
        />
      ) : (
        <div className="space-y-4">
          {personas.map((persona) => (
            <PersonaCard
              key={persona.id}
              persona={persona}
              onToggle={handleToggle}
              onDelete={handleDelete}
            />
          ))}
        </div>
      )}
    </div>
  )
}
