import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query"
import { apiClient } from "./client"
import type { Persona, PersonaInput } from "../types/persona"

export function usePersonas(activeOnly = true) {
  return useQuery({
    queryKey: ["personas", activeOnly],
    queryFn: () =>
      apiClient<Persona[]>(`/api/personas?activeOnly=${activeOnly}`),
    staleTime: 60_000,
  })
}

export function usePersona(id: string) {
  return useQuery({
    queryKey: ["persona", id],
    queryFn: () => apiClient<Persona>(`/api/personas/${id}`),
    staleTime: 60_000,
  })
}

export function useCreatePersona() {
  const queryClient = useQueryClient()
  return useMutation({
    mutationFn: (input: PersonaInput) =>
      apiClient<Persona>("/api/personas", {
        method: "POST",
        body: JSON.stringify(input),
      }),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["personas"] })
    },
  })
}

export function useUpdatePersona() {
  const queryClient = useQueryClient()
  return useMutation({
    mutationFn: ({ id, input }: { id: string; input: Partial<PersonaInput> }) =>
      apiClient<Persona>(`/api/personas/${id}`, {
        method: "PUT",
        body: JSON.stringify(input),
      }),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["personas"] })
    },
  })
}

export function useTogglePersona() {
  const queryClient = useQueryClient()
  return useMutation({
    mutationFn: (id: string) =>
      apiClient<Persona>(`/api/personas/${id}/toggle`, {
        method: "PATCH",
      }),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["personas"] })
    },
  })
}

export function useDeletePersona() {
  const queryClient = useQueryClient()
  return useMutation({
    mutationFn: (id: string) =>
      apiClient<{ success: boolean }>(`/api/personas/${id}`, {
        method: "DELETE",
      }),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["personas"] })
    },
  })
}
