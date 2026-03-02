import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query"
import { apiClient } from "./client"

export interface AuthStatusResult {
  ok: boolean
  provider: string
  errorMessage: string | null
}

export interface AuthRefreshResult {
  ok: boolean
  method: "oauth" | "api"
  message: string
}

/**
 * Checks whether a provider's credentials are valid.
 * Refetches every 60s so the banner stays current without hammering the server.
 * Pass enabled=false to skip the check (e.g. when no persona is assigned).
 */
export function useAuthStatus(provider: string | null | undefined, enabled = true) {
  return useQuery({
    queryKey: ["auth-status", provider],
    queryFn: () =>
      apiClient<AuthStatusResult>(
        `/api/auth/status?provider=${encodeURIComponent(provider!)}`
      ),
    enabled: enabled && !!provider,
    staleTime: 60_000,
    refetchInterval: 60_000,
    // Don't retry on auth errors — they won't resolve without user action
    retry: false,
  })
}

/**
 * Triggers an auth refresh (OAuth login flow or API key guidance).
 */
export function useAuthRefresh() {
  const queryClient = useQueryClient()
  return useMutation({
    mutationFn: (provider: string) =>
      apiClient<AuthRefreshResult>("/api/auth/refresh", {
        method: "POST",
        body: JSON.stringify({ provider }),
      }),
    onSuccess: (_, provider) => {
      // Invalidate so the status banner re-checks after the flow completes
      queryClient.invalidateQueries({ queryKey: ["auth-status", provider] })
    },
  })
}
