import * as taskService from "../services/taskService"
import * as personaService from "../services/personaService"
import * as eventService from "../services/eventService"
import { TaskStatus } from "../db/schema"
import { runSession } from "../opencode/sessionRunner"
import { runPlanningSession } from "../opencode/planningRunner"
import type { EventType } from "./eventService"

const maxConcurrent = parseInt(process.env.MAX_CONCURRENT_SESSIONS || "3", 10)
let activeCount = 0

function sleep(ms: number): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, ms))
}

async function runTaskSession(task: { id: string; title: string; description: string; repoPath: string; codingPersonaId: string; planPath?: string | null }) {
  const persona = await personaService.getPersona(task.codingPersonaId)
  if (!persona) {
    await taskService.markTaskFailed(task.id, "Coding persona not found")
    return
  }

  try {
    await taskService.updateTaskStatus(task.id, TaskStatus.RUNNING, { startedAt: new Date().toISOString() })

    const result = await runSession(
      { id: task.id, title: task.title, description: task.description, repoPath: task.repoPath, planPath: task.planPath },
      persona
    )

    if (result.success) {
      await taskService.updateTaskStatus(task.id, TaskStatus.AWAITING_REVIEW, {
        diffPath: result.diffPath,
        outputLog: result.logPath,
        sessionId: result.sessionId,
        completedAt: new Date().toISOString(),
      })
    } else {
      await taskService.markTaskFailed(task.id, result.errorMessage || "Session failed")
    }
  } catch (error) {
    const errorMessage = error instanceof Error ? error.message : String(error)
    await taskService.markTaskFailed(task.id, errorMessage)
  } finally {
    activeCount--
  }
}

async function runPlanningTaskSession(task: {
  id: string
  title: string
  description: string
  repoPath: string
  planPath: string | null
  planningPersonaId: string
}) {
  const persona = await personaService.getPersona(task.planningPersonaId)
  if (!persona) {
    await taskService.markTaskFailed(task.id, "Planning persona not found")
    return
  }

  try {
    await taskService.updateTaskStatus(task.id, TaskStatus.IN_PLANNING, { startedAt: new Date().toISOString() })

    const result = await runPlanningSession(
      {
        taskId: task.id,
        taskTitle: task.title,
        taskDescription: task.description,
        repoPath: task.repoPath,
        planPath: task.planPath ?? undefined,
        planningPersona: {
          id: persona.id,
          name: persona.name,
          model: persona.model,
          systemPrompt: persona.systemPrompt,
          allowedTools: persona.allowedTools,
          provider: persona.provider,
        },
      },
      async (type, payload) => {
        await eventService.appendEvent(task.id, type as EventType, payload as any)
      }
    )

    if (result.success) {
      await taskService.updateTaskStatus(task.id, TaskStatus.PLANNED, {
        planPath: result.planDocPath,
      })
    } else {
      await taskService.markTaskFailed(task.id, result.errorMessage || "Planning session failed")
    }
  } catch (error) {
    const errorMessage = error instanceof Error ? error.message : String(error)
    await taskService.markTaskFailed(task.id, errorMessage)
  } finally {
    activeCount--
  }
}

export async function startQueueWorker() {
  console.log("Queue worker started")
  console.log(`Max concurrent sessions: ${maxConcurrent}`)

  const resetCount = await taskService.resetStuckTasks()
  if (resetCount > 0) {
    console.log(`Reset ${resetCount} stuck tasks (IN_PLANNING, QUEUED, RUNNING) to DRAFT`)
  }

  while (true) {
    try {
      if (activeCount < maxConcurrent) {
        const planningTask = await taskService.claimNextPlanningTask()
        if (planningTask && planningTask.planningPersonaId) {
          activeCount++
          console.log(`Claimed planning task ${planningTask.id}: ${planningTask.title}`)
          await runPlanningTaskSession({
            id: planningTask.id,
            title: planningTask.title,
            description: planningTask.description,
            repoPath: planningTask.repoPath,
            planPath: planningTask.planPath,
            planningPersonaId: planningTask.planningPersonaId,
          }).catch(err => console.error(`Planning task ${planningTask.id} failed:`, err))
        } else {
          const task = await taskService.claimNextReadyTask()

          if (task) {
            activeCount++
            console.log(`Claimed task ${task.id}: ${task.title}`)
            await runTaskSession(task).catch(err => console.error(`Task ${task.id} failed with error:`, err))
          } else {
            // No tasks ready — back off to avoid busy-looping the event loop
            await sleep(2000)
          }
        }
      } else {
        await sleep(3000)
      }
    } catch (err) {
      console.error("Queue worker error:", err)
    }
  }
}
