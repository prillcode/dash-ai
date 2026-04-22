import * as taskService from "../services/taskService"
import * as personaService from "../services/personaService"
import * as eventService from "../services/eventService"
import { TaskStatus } from "../db/schema"
import { runCodingSession } from "../agent/codingRunner"
import { runPlanningSession } from "../agent/planningRunner"
import type { EventType } from "./eventService"

const maxConcurrent = parseInt(process.env.MAX_CONCURRENT_SESSIONS || "2", 10)
let activeCount = 0

function sleep(ms: number): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, ms))
}

async function runTaskSession(task: { id: string; title: string; description: string; repoPath: string; codingPersonaId: string; planPath?: string | null; codingFeedback?: string | null }) {
  const persona = await personaService.getPersona(task.codingPersonaId)
  if (!persona) {
    await taskService.markTaskFailed(task.id, "Coding persona not found")
    return
  }

  try {
    await taskService.updateTaskStatus(task.id, TaskStatus.RUNNING, { startedAt: new Date().toISOString() })

    const result = await runCodingSession(
      {
        taskId: task.id,
        taskTitle: task.title,
        taskDescription: task.description,
        repoPath: task.repoPath,
        planPath: task.planPath || "",
        codingFeedback: task.codingFeedback,
        codingPersona: {
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
      },
      {
        onSessionReady: async ({ sessionId }) => {
          await taskService.updateTaskStatus(task.id, TaskStatus.RUNNING, { sessionId })
        },
      }
    )

    const latest = await taskService.getTask(task.id)
    if (!latest || latest.status !== TaskStatus.RUNNING) {
      return
    }

    if (result.success) {
      await taskService.updateTaskStatus(task.id, TaskStatus.AWAITING_REVIEW, {
        diffPath: result.diffPath,
        outputLog: result.logPath,
        sessionId: result.sessionId,
        completedAt: new Date().toISOString(),
      })
    } else {
      await taskService.updateTaskStatus(task.id, TaskStatus.FAILED, {
        outputLog: result.logPath,
        sessionId: result.sessionId || null,
        errorMessage: result.errorMessage || (result.noChanges ? "Coding session completed with no code changes" : "Session failed"),
        completedAt: new Date().toISOString(),
      })
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
  identifier?: string | null
  targetFiles?: string[]
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
        taskIdentifier: task.identifier ?? undefined,
        targetFiles: task.targetFiles,
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

  const { planningResetCount, codingResetCount } = await taskService.resetStuckTasks()
  if (planningResetCount > 0) {
    console.log(`Reset ${planningResetCount} stuck planning task(s) from IN_PLANNING to DRAFT`)
  }
  if (codingResetCount > 0) {
    console.log(`Reset ${codingResetCount} stuck coding task(s) from QUEUED/RUNNING to READY_TO_CODE`)
  }

  while (true) {
    try {
      if (activeCount < maxConcurrent) {
        const planningTask = await taskService.claimNextPlanningTask()
        if (planningTask && planningTask.planningPersonaId) {
          activeCount++
          console.log(`Claimed planning task ${planningTask.id}: ${planningTask.title}`)
          // Run detached — do NOT await, so the worker loop stays responsive
          runPlanningTaskSession({
            id: planningTask.id,
            title: planningTask.title,
            description: planningTask.description,
            repoPath: planningTask.repoPath,
            planPath: planningTask.planPath,
            planningPersonaId: planningTask.planningPersonaId,
            identifier: planningTask.identifier,
            targetFiles: planningTask.targetFiles as unknown as string[] | undefined,
          }).catch(err => console.error(`Planning task ${planningTask.id} failed:`, err))
        } else {
          const task = await taskService.claimNextQueuedTask()

          if (task) {
            activeCount++
            console.log(`Claimed task ${task.id}: ${task.title}`)
            // Run detached — do NOT await
            runTaskSession(task).catch(err => console.error(`Task ${task.id} failed with error:`, err))
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
