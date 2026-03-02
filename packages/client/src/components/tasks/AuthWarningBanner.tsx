import { useState } from "react"
import { usePersona } from "../../api/personas"
import { useAuthStatus, useAuthRefresh } from "../../api/auth"

interface AuthWarningBannerProps {
  /** Persona ID to check auth for */
  personaId: string | null | undefined
  /** Label shown in the banner, e.g. "Planning" or "Coding" */
  label: string
}

/**
 * Checks the auth status of a persona's provider and shows an amber warning
 * banner if credentials are missing or expired. Only renders for OAuth
 * providers where token expiry is a real concern — API key users see nothing
 * unless the key is completely absent.
 */
export function AuthWarningBanner({ personaId, label }: AuthWarningBannerProps) {
  const [refreshResult, setRefreshResult] = useState<string | null>(null)

  const { data: persona } = usePersona(personaId ?? "", {
    enabled: !!personaId,
  })

  const provider = persona?.provider ?? null

  const { data: authStatus } = useAuthStatus(provider, !!provider)
  const refresh = useAuthRefresh()

  // Nothing to show if auth is fine or we don't have data yet
  if (!authStatus || authStatus.ok) return null

  const handleRefresh = async () => {
    if (!provider) return
    setRefreshResult(null)
    try {
      const result = await refresh.mutateAsync(provider)
      setRefreshResult(result.message)
    } catch {
      setRefreshResult("Failed to start auth flow. Please reconnect manually via the OpenCode TUI.")
    }
  }

  return (
    <div className="rounded-lg border border-yellow-500/40 bg-yellow-500/10 p-3 text-sm">
      <div className="flex items-start justify-between gap-3">
        <div className="flex-1">
          <span className="font-medium text-yellow-400">
            {label} persona ({persona?.name}) — auth issue
          </span>
          <p className="mt-0.5 text-yellow-300/80">
            {authStatus.errorMessage}
          </p>
          {refreshResult && (
            <p className="mt-1.5 text-yellow-200/70 italic">{refreshResult}</p>
          )}
        </div>
        <button
          onClick={handleRefresh}
          disabled={refresh.isPending}
          className="shrink-0 rounded px-2.5 py-1 text-xs font-medium bg-yellow-500/20 hover:bg-yellow-500/30 text-yellow-300 border border-yellow-500/30 transition-colors disabled:opacity-50"
        >
          {refresh.isPending ? "Starting..." : "Reconnect"}
        </button>
      </div>
    </div>
  )
}
