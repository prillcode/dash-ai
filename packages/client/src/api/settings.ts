import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query"
import { apiClient } from "./client"

export interface Settings {
  defaultProvider?: string
  defaultModel?: string
  defaultPlannerPersonaId?: string
  defaultCoderPersonaId?: string
  defaultProjectId?: string
  autoStartPlanning?: boolean
  uiTheme?: "dark" | "light" | "system"
  confirmDestructiveActions?: boolean
  agentMdPrompt?: string
}

export function useSettings() {
  return useQuery({
    queryKey: ["settings"],
    queryFn: () => apiClient<Settings>("/api/settings"),
    staleTime: 30_000,
  })
}

export function useUpdateSettings() {
  const queryClient = useQueryClient()
  return useMutation({
    mutationFn: (settings: Partial<Settings>) =>
      apiClient<Settings>("/api/settings", {
        method: "PATCH",
        body: JSON.stringify(settings),
      }),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["settings"] })
    },
  })
}
