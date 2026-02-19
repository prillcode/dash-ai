import { useParams, useNavigate } from "react-router-dom"
import { usePersona, useCreatePersona, useUpdatePersona } from "../api/personas"
import { PersonaForm } from "../components/personas"
import { Button, Spinner } from "../components/ui"
import type { PersonaInput } from "../types/persona"

export function PersonaFormPage() {
  const { id } = useParams<{ id: string }>()
  const navigate = useNavigate()
  const isEdit = Boolean(id)

  const { data: persona, isLoading: isLoadingPersona } = usePersona(id!)
  const createPersona = useCreatePersona()
  const updatePersona = useUpdatePersona()

  const handleSubmit = (data: PersonaInput) => {
    if (isEdit && id) {
      updatePersona.mutate(
        { id, input: data },
        {
          onSuccess: () => {
            navigate("/personas")
          },
        }
      )
    } else {
      createPersona.mutate(data, {
        onSuccess: () => {
          navigate("/personas")
        },
      })
    }
  }

  if (isEdit && isLoadingPersona) {
    return (
      <div className="flex items-center justify-center h-64">
        <Spinner size="lg" />
      </div>
    )
  }

  return (
    <div className="max-w-2xl mx-auto space-y-6">
      <div className="flex items-center justify-between">
        <h1 className="text-2xl font-bold">
          {isEdit ? "Edit Persona" : "Create Persona"}
        </h1>
        <Button variant="ghost" onClick={() => navigate("/personas")}>
          Cancel
        </Button>
      </div>

      <div className="border rounded-lg p-6 bg-white">
        <PersonaForm
          initialData={persona}
          onSubmit={handleSubmit}
          isLoading={createPersona.isPending || updatePersona.isPending}
        />
      </div>
    </div>
  )
}
