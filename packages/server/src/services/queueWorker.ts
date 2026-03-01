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
    await eventService.appendEvent(task.id, "STATUS_CHANGE", { from: TaskStatus.QUEUED, to: TaskStatus.RUNNING })

    const result = await runSession(
      { id: task.id, title: task.title, description: task.description, repoPath: task.repoPath, planPath: task.planPath },
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

  // Derive planPath if not set: slugify task title + task id prefix
  const planPath = task.planPath || `${task.id.slice(0, 8)}-${task.title.toLowerCase().replace(/[^a-z0-9]+/g, "-").slice(0, 40)}`

  try {
    await eventService.appendEvent(task.id, "STATUS_CHANGE", {
      from: TaskStatus.IN_PLANNING,
      to: TaskStatus.IN_PLANNING,
      message: "Planning session starting",
    })

    const result = await runPlanningSession(
      {
        taskId: task.id,
        taskTitle: task.title,
        taskDescription: task.description,
        repoPath: task.repoPath,
        planPath,
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
        planPath,
      })
      await eventService.appendEvent(task.id, "STATUS_CHANGE", {
        from: TaskStatus.IN_PLANNING,
        to: TaskStatus.PLANNED,
      })
    } else {
      await taskService.markTaskFailed(task.id, result.errorMessage || "Planning session failed")
    }
  } catch (error) {
    const msg = error instanceof Error ? error.message : String(error)
    await taskService.markTaskFailed(task.id, msg)
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
        // Try planning tasks first
        const planningTask = await taskService.claimNextPlanningTask()
        if (planningTask && planningTask.planningPersonaId) {
          activeCount++
          console.log(`Claimed planning task ${planningTask.id}: ${planningTask.title}`)
          
          runPlanningTaskSession({
            id: planningTask.id,
            title: planningTask.title,
            description: planningTask.description,
            repoPath: planningTask.repoPath,
            planPath: planningTask.planPath,
            planningPersonaId: planningTask.planningPersonaId,
          }).catch(err => console.error(`Planning task ${planningTask.id} failed:`, err))
        } else {
          // Fall back to coding tasks
          const task = await taskService.claimNextReadyTask()

          if (task) {
            activeCount++
            console.log(`Claimed task ${task.id}: ${task.title}`)
            
            await eventService.appendEvent(task.id, "STATUS_CHANGE", { from: TaskStatus.READY_TO_CODE, to: TaskStatus.QUEUED })

            runTaskSession(task).catch((err) => {
              console.error(`Task ${task.id} failed with error:`, err)
            })
          }
        }
      }
    } catch (err) {
      console.error("Queue worker error:", err)
    }

    await sleep(3000)
  }
}
