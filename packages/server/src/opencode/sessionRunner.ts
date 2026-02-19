import * as eventService from "../services/eventService"
import * as taskService from "../services/taskService"
import { TaskStatus } from "../db/schema"
import { now } from "../utils/time"
import fs from "fs/promises"
import path from "path"

interface Persona {
  id: string
  name: string
  systemPrompt: string
  model: string
  allowedTools: string[]
  contextFiles: string[]
}

interface Task {
  id: string
  title: string
  description: string
  repoPath: string
}

interface SessionResult {
  diffPath: string
  logPath: string
  sessionId: string
}

export class SessionRunner {
  private task: Task
  private persona: Persona
  private workingDir: string
  private diffDir: string
  private logDir: string

  constructor(task: Task, persona: Persona) {
    this.task = task
    this.persona = persona
    this.workingDir = process.env.OPENCODE_WORKING_DIR || "/tmp/opencode-workspaces"
    this.diffDir = process.env.DIFF_STORAGE_DIR || "/tmp/ai-dashboard/diffs"
    this.logDir = process.env.LOG_STORAGE_DIR || "/tmp/ai-dashboard/sessions"
  }

  async run(): Promise<SessionResult> {
    const taskId = this.task.id
    const sessionId = `session-${taskId}-${Date.now()}`
    const logEntries: string[] = []

    try {
      logEntries.push(`[${now()}] Starting session for task: ${this.task.title}`)
      logEntries.push(`[${now()}] Using persona: ${this.persona.name}`)
      logEntries.push(`[${now()}] Model: ${this.persona.model}`)

      // TODO: Implement actual OpenCode SDK integration
      // This is a placeholder that will need to be updated based on the actual SDK API
      // The implementation should:
      // 1. Create an OpenCode session with the persona's model
      // 2. Inject the system prompt and context files
      // 3. Send the task description
      // 4. Subscribe to events and forward them to eventService
      // 5. Capture the diff and save it
      // 6. Save the session log

      // Placeholder: Simulate some events
      await eventService.appendEvent(taskId, "STATUS_CHANGE", {
        from: "RUNNING",
        to: "RUNNING",
      })

      // Create diff directory
      await fs.mkdir(path.join(this.diffDir, taskId), { recursive: true })
      const diffPath = path.join(this.diffDir, taskId, "changes.diff")
      
      // Placeholder diff content
      const diffContent = `# Diff for task: ${this.task.title}\n# TODO: Replace with actual diff from OpenCode SDK\n`
      await fs.writeFile(diffPath, diffContent)
      logEntries.push(`[${now()}] Wrote diff to ${diffPath}`)

      // Create log directory and save session log
      await fs.mkdir(path.join(this.logDir, taskId), { recursive: true })
      const logPath = path.join(this.logDir, taskId, "session.log")
      await fs.writeFile(logPath, logEntries.join("\n"))
      logEntries.push(`[${now()}] Wrote log to ${logPath}`)

      return { diffPath, logPath, sessionId }
    } catch (error) {
      const errorMessage = error instanceof Error ? error.message : String(error)
      logEntries.push(`[${now()}] ERROR: ${errorMessage}`)
      
      await eventService.appendEvent(taskId, "ERROR", {
        message: errorMessage,
      })
      
      throw error
    }
  }
}

export async function runSession(
  task: Task,
  persona: Persona
): Promise<SessionResult> {
  const runner = new SessionRunner(task, persona)
  return runner.run()
}
