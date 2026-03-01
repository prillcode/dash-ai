import * as eventService from "../services/eventService"
import { runCodingSession } from "./codingRunner"
import type { EventType } from "../services/eventService"

interface Persona {
  id: string
  name: string
  systemPrompt: string
  model: string
  allowedTools: string[]
  contextFiles: string[]
  provider?: string
}

interface Task {
  id: string
  title: string
  description: string
  repoPath: string
  planPath?: string | null
}

interface SessionResult {
  success: boolean
  diffPath: string
  logPath: string
  sessionId: string
  errorMessage?: string
}

export class SessionRunner {
  private task: Task
  private persona: Persona

  constructor(task: Task, persona: Persona) {
    this.task = task
    this.persona = persona
  }

  async run(): Promise<SessionResult> {
    const taskId = this.task.id

    try {
      return await runSession(this.task, this.persona)
    } catch (error) {
      const errorMessage = error instanceof Error ? error.message : String(error)

      await eventService.appendEvent(taskId, "ERROR", {
        message: errorMessage,
      })

      return {
        success: false,
        diffPath: "",
        logPath: "",
        sessionId: "",
        errorMessage,
      }
    }
  }
}

export async function runSession(
  task: Task,
  persona: Persona
): Promise<SessionResult> {
  const result = await runCodingSession(
    {
      taskId: task.id,
      taskTitle: task.title,
      taskDescription: task.description,
      repoPath: task.repoPath,
      planPath: task.planPath || "",
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
    }
  )

  if (!result.success) {
    return {
      success: false,
      diffPath: result.diffPath || "",
      logPath: result.logPath || "",
      sessionId: result.sessionId,
      errorMessage: result.errorMessage || "Coding session failed",
    }
  }

  return {
    success: true,
    diffPath: result.diffPath || "",
    logPath: result.logPath || "",
    sessionId: result.sessionId,
  }
}
