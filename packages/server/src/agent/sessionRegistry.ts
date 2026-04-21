type AbortableSession = {
  abort: () => void
}

const activeCodingSessions = new Map<string, AbortableSession>()

export function registerCodingSession(taskId: string, session: AbortableSession) {
  activeCodingSessions.set(taskId, session)
}

export function unregisterCodingSession(taskId: string) {
  activeCodingSessions.delete(taskId)
}

export function cancelCodingSession(taskId: string): boolean {
  const session = activeCodingSessions.get(taskId)
  if (!session) return false
  session.abort()
  activeCodingSessions.delete(taskId)
  return true
}

export function hasActiveCodingSession(taskId: string): boolean {
  return activeCodingSessions.has(taskId)
}
