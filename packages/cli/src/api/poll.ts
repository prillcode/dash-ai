import type { DashAiClient } from "./client"

export interface Task {
  id: string
  title: string
  status: string
  planPath?: string | null
  diffPath?: string | null
  errorMessage?: string | null
  completedAt?: string | null
  [key: string]: unknown
}

export interface PollOptions {
  targetStatus: string[]
  intervalMs?: number
  timeoutMs?: number
  onPoll?: (task: Task) => void
}

function sleep(ms: number): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, ms))
}

/**
 * Poll a task's status until it reaches one of the target statuses,
 * or the timeout is exceeded.
 */
export async function pollTaskStatus(
  client: DashAiClient,
  taskId: string,
  options: PollOptions
): Promise<Task> {
  const { targetStatus, intervalMs = 2000, timeoutMs = 20 * 60 * 1000 } = options
  const start = Date.now()

  while (true) {
    const task = await client.get<Task>(`/api/tasks/${taskId}`)

    if (options.onPoll) {
      options.onPoll(task)
    }

    if (targetStatus.includes(task.status)) {
      return task
    }

    if (Date.now() - start > timeoutMs) {
      throw new Error(
        `Polling timed out after ${Math.round(timeoutMs / 1000)}s. Task is still "${task.status}".`
      )
    }

    await sleep(intervalMs)
  }
}
