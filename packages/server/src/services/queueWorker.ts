import * as taskService from "../services/taskService"
import * as personaService from "../services/personaService"
import * as eventService from "../services/eventService"
import { TaskStatus } from "../db/schema"
import { runSession } from "../opencode/sessionRunner"

const maxConcurrent = parseInt(process.env.MAX_CONCURRENT_SESSIONS || "3", 10)
let activeCount = 0

function sleep(ms: number): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, ms))
}

async function runTaskSession(task: { id: string; title: string; description: string; repoPath: string; personaId: string }) {
  const persona = await personaService.getPersona(task.personaId)
  if (!persona) {
    await taskService.markTaskFailed(task.id, "Persona not found")
    return
  }

  try {
    await taskService.updateTaskStatus(task.id, TaskStatus.RUNNING, { startedAt: new Date().toISOString() })
    await eventService.appendEvent(task.id, "STATUS_CHANGE", { from: TaskStatus.QUEUED, to: TaskStatus.RUNNING })

    const result = await runSession(
      { id: task.id, title: task.title, description: task.description, repoPath: task.repoPath },
      persona
    )

    await taskService.updateTaskStatus(task.id, TaskStatus.AWAITING_REVIEW, {
      diffPath: result.diffPath,
      outputLog: result.logPath,
      sessionId: result.sessionId,
      completedAt: new Date().toISOString(),
    })
    await eventService.appendEvent(task.id, "STATUS_CHANGE", { from: TaskStatus.RUNNING, to: TaskStatus.AWAITING_REVIEW })
  } catch (error) {
    const errorMessage = error instanceof Error ? error.message : String(error)
    await taskService.markTaskFailed(task.id, errorMessage)
    await eventService.appendEvent(task.id, "STATUS_CHANGE", { from: TaskStatus.RUNNING, to: TaskStatus.FAILED })
    await eventService.appendEvent(task.id, "ERROR", { message: errorMessage })
  } finally {
    activeCount--
  }
}

export async function startQueueWorker() {
  console.log("Queue worker started")
  console.log(`Max concurrent sessions: ${maxConcurrent}`)

  const resetCount = await taskService.resetStuckTasks()
  if (resetCount > 0) {
    console.log(`Reset ${resetCount} stuck tasks to PENDING`)
  }

  while (true) {
    try {
      if (activeCount < maxConcurrent) {
        const task = await taskService.claimNextPendingTask()

        if (task) {
          activeCount++
          console.log(`Claimed task ${task.id}: ${task.title}`)
          
          await eventService.appendEvent(task.id, "STATUS_CHANGE", { from: TaskStatus.PENDING, to: TaskStatus.QUEUED })

          runTaskSession(task).catch((err) => {
            console.error(`Task ${task.id} failed with error:`, err)
          })
        }
      }
    } catch (err) {
      console.error("Queue worker error:", err)
    }

    await sleep(3000)
  }
}
