import chalk from "chalk"
import { WebSocket } from "ws"
import { Command } from "commander"
import { resolveClient } from "../api/resolver"
import { getContext, type CliContext } from "../context"
import { formatTable, relativeTime, truncate, printError, printSuccess, printWarn } from "../output/format"
import { ApiError } from "../api/client"
import { pollTaskStatus, type Task } from "../api/poll"

interface Project { id: string; name: string }
interface Persona { id: string; name: string; personaType: string; isActive: boolean }
interface Persona { id: string; name: string }
interface PlanDocResponse { file: string; content: string }

export function registerTaskCommands(program: Command): void {
  const tasks = program.command("tasks").description("Manage and run tasks")

  // ─── LIST ───────────────────────────────────────────────────────────────────
  tasks
    .command("list")
    .description("List tasks")
    .option("--status <status>", "filter by status (DRAFT, PLANNED, RUNNING, etc.)")
    .option("--project <name>", "filter by project name")
    .option("--json", "output as JSON")
    .option("--quiet", "suppress non-essential output")
    .option("--no-color", "disable color output")
    .option("--url <url>", "override DASH_AI_URL")
    .option("--token <token>", "override DASH_AI_TOKEN")
    .action(async (opts) => {
      const ctx = getContext(opts)
      try {
        const { client } = await resolveClient(ctx)
        const params = new URLSearchParams()
        if (opts.status) params.set("status", opts.status)
        if (opts.project) params.set("projectName", opts.project)

        const tasks = await client.get<Task[]>(`/api/tasks?${params}`)

        if (ctx.json) {
          console.log(JSON.stringify({ success: true, data: { tasks } }, null, 2))
        } else if (tasks.length === 0) {
          console.log(chalk.gray("No tasks found."))
        } else {
          console.log(
            formatTable(
              ["ID", "Title", "Status", "Priority", "Project", "Updated"],
              tasks.map((t) => [
                t.id.slice(0, 8),
                truncate(t.title || "", 40),
                formatStatus(t.status, ctx),
                String(t.priority ?? "—"),
                (t as any).projectName ? truncate((t as any).projectName, 20) : "—",
                t.updatedAt ? relativeTime(t.updatedAt as unknown as string) : "—",
              ])
            )
          )
        }
      } catch (err) { handleError(err) }
    })

  // ─── UPDATE ─────────────────────────────────────────────────────────────────
  tasks
    .command("update <id>")
    .description("Update a task's title, description, or priority")
    .option("--title <title>", "new title")
    .option("--description <desc>", "new description")
    .option("--priority <n>", "priority 1-5", (v) => parseInt(v))
    .option("--json", "output as JSON")
    .option("--quiet", "suppress non-essential output")
    .option("--no-color", "disable color output")
    .option("--url <url>", "override DASH_AI_URL")
    .option("--token <token>", "override DASH_AI_TOKEN")
    .action(async (id, opts) => {
      const ctx = getContext(opts)
      if (!opts.title && !opts.description && opts.priority === undefined) {
        process.stderr.write(chalk.red("Error: specify at least one of --title, --description, or --priority\n"))
        process.exit(1)
      }
      try {
        const { client, embedded } = await resolveClient(ctx)
        const body: Record<string, unknown> = {}
        if (opts.title) body.title = opts.title
        if (opts.description) body.description = opts.description
        if (opts.priority !== undefined) body.priority = opts.priority
        const task = await client.patch<Task>(`/api/tasks/${id}`, body)
        if (embedded) {
          const { teardownEmbeddedServer } = await import("../embedded/server")
          await teardownEmbeddedServer()
        }
        if (ctx.json) {
          console.log(JSON.stringify({ success: true, data: { task } }, null, 2))
        } else {
          console.log(chalk.green("✓"), `Task updated: ${task.title}`)
        }
      } catch (err) { handleError(err) }
    })

  // ─── CREATE ─────────────────────────────────────────────────────────────────
  tasks
    .command("create")
    .description("Create a new task")
    .requiredOption("--project <name>", "project name")
    .requiredOption("--title <title>", "task title")
    .option("--description <desc>", "task description")
    .option("--planner <name>", "planning persona name")
    .option("--coder <name>", "coding persona name (required)")
    .option("--auto-plan", "immediately start planning after creation")
    .option("--json", "output as JSON")
    .option("--quiet", "suppress non-essential output")
    .option("--no-color", "disable color output")
    .option("--url <url>", "override DASH_AI_URL")
    .option("--token <token>", "override DASH_AI_TOKEN")
    .action(async (opts) => {
      const ctx = getContext(opts)
      try {
        const { client, embedded } = await resolveClient(ctx)
        try {
          // Resolve project name → id
          const projects = await client.get<Project[]>("/api/projects")
          const project = projects.find((p) => p.name === opts.project)
          if (!project) printError(ctx, `Project not found: ${opts.project}`, 3)
          const projectId = project!.id

          // Resolve personas
          let planningPersonaId: string | undefined
          let codingPersonaId: string | undefined

          if (opts.planner) {
            const personas = await client.get<Persona[]>("/api/personas?activeOnly=false")
            const p = personas.find((x) => x.name.toLowerCase() === opts.planner!.toLowerCase())
            if (!p) printError(ctx, `Planning persona not found: ${opts.planner}`, 3)
            planningPersonaId = p!.id
          }

          const personas = await client.get<Persona[]>("/api/personas?activeOnly=false")
          if (opts.coder) {
            const c = personas.find((x) => x.name.toLowerCase() === opts.coder!.toLowerCase())
            if (!c) printError(ctx, `Coding persona not found: ${opts.coder}`, 3)
            codingPersonaId = c!.id
          } else {
            // Default to first coding persona
            const defaultCoder = personas.find((x) => x.personaType === "coder" && x.isActive)
            if (!defaultCoder) printError(ctx, "No coding persona found. Use --coder to specify one.", 3)
            codingPersonaId = defaultCoder!.id
          }

          const body: Record<string, unknown> = {
            projectId,
            codingPersonaId: codingPersonaId!,
            title: opts.title,
            description: opts.description || opts.title,
          }
          if (planningPersonaId) body.planningPersonaId = planningPersonaId

          const task = await client.post<Task>("/api/tasks", body)

          if (opts.autoPlan) {
            await client.post(`/api/tasks/${task.id}/start-planning`)
            if (ctx.json) {
              console.log(JSON.stringify({ success: true, data: { taskId: task.id, status: "IN_PLANNING" } }, null, 2))
            } else {
              console.log(chalk.green("✓"), `Task created and planning started: ${task.id}`)
              console.log(`  Watch: dash-ai tasks watch ${task.id}`)
            }
          } else {
            if (ctx.json) {
              console.log(JSON.stringify({ success: true, data: { task } }, null, 2))
            } else {
              console.log(chalk.green("✓"), `Task created: ${task.id}`)
              console.log(`  Title:    ${task.title}`)
              console.log(`  Project:  ${opts.project}`)
              console.log(`  Plan:     dash-ai tasks plan ${task.id}`)
            }
          }
        } finally {
          if (embedded) {
            const { teardownEmbeddedServer } = await import("../embedded/server")
            await teardownEmbeddedServer()
          }
        }
      } catch (err) { handleError(err) }
    })

  // ─── SHOW ───────────────────────────────────────────────────────────────────
  tasks
    .command("show <id>")
    .description("Show task details")
    .option("--json", "output as JSON")
    .option("--quiet", "suppress non-essential output")
    .option("--no-color", "disable color output")
    .option("--url <url>", "override DASH_AI_URL")
    .option("--token <token>", "override DASH_AI_TOKEN")
    .action(async (id, opts) => {
      const ctx = getContext(opts)
      try {
        const { client, embedded } = await resolveClient(ctx)
        try {
          const task = await client.get<Task>(`/api/tasks/${id}`)
          if (ctx.json) {
            console.log(JSON.stringify({ success: true, data: { task } }, null, 2))
          } else {
            printTask(task, ctx)
          }
        } finally {
          if (embedded) {
            const { teardownEmbeddedServer } = await import("../embedded/server")
            await teardownEmbeddedServer()
          }
        }
      } catch (err) { handleError(err) }
    })

  // ─── PLAN ──────────────────────────────────────────────────────────────────
  tasks
    .command("plan <id>")
    .description("Start or iterate a planning session")
    .option("--feedback <text>", "feedback for plan iteration")
    .option("--json", "output as JSON")
    .option("--quiet", "suppress non-essential output")
    .option("--no-color", "disable color output")
    .option("--url <url>", "override DASH_AI_URL")
    .option("--token <token>", "override DASH_AI_TOKEN")
    .action(async (id, opts) => {
      const ctx = getContext(opts)
      try {
        const { client, embedded } = await resolveClient(ctx)
        try {
          const task = await client.get<Task>(`/api/tasks/${id}`)

          if (opts.feedback) {
            if (task.status !== "PLANNED") {
              printError(ctx, `Can only iterate PLANNED tasks. Current: ${task.status}`, 1)
            }
            await client.post(`/api/tasks/${id}/iterate-plan`, { feedback: opts.feedback })
            if (!ctx.quiet) console.log(chalk.blue("↻"), "Plan iteration triggered...")
          } else {
            if (task.status !== "DRAFT") {
              printError(ctx, `Can only plan DRAFT tasks. Current: ${task.status}`, 1)
            }
            await client.post(`/api/tasks/${id}/start-planning`)
            if (!ctx.quiet) console.log(chalk.blue("⏳"), "Planning started...")
          }

          const spinner = (await import("ora")).default(opts.feedback ? "Iterating plan..." : "Planning...").start()

          const finalTask = await pollTaskStatus(client, id, {
            targetStatus: ["PLANNED", "FAILED"],
            onPoll: (t) => {
              spinner.text = `${t.status}...`
            },
          })

          spinner.stop()

          if (finalTask.status === "FAILED") {
            printError(ctx, `Planning failed: ${finalTask.errorMessage || "unknown error"}`, 6)
          }

          if (ctx.json) {
            console.log(JSON.stringify({
              success: true,
              data: { taskId: id, status: finalTask.status, planPath: finalTask.planPath },
            }, null, 2))
          } else {
            printSuccess(ctx, "Planning complete!")
            console.log(`  Plan:  ${finalTask.planPath}`)
            console.log(`  Docs:  dash-ai tasks plan-docs ${id}`)
          }
        } finally {
          if (embedded) {
            const { teardownEmbeddedServer } = await import("../embedded/server")
            await teardownEmbeddedServer()
          }
        }
      } catch (err) { handleError(err) }
    })

  // ─── PLAN-DOCS ─────────────────────────────────────────────────────────────
  tasks
    .command("plan-docs <id>")
    .description("Read plan documents for a task")
    .option("--file <name>", "specific file (BRIEF.md, ROADMAP.md, ISSUES.md)")
    .option("--stdout", "pipe raw content to stdout (for agent consumption)")
    .option("--json", "output as JSON")
    .option("--quiet", "suppress non-essential output")
    .option("--no-color", "disable color output")
    .option("--url <url>", "override DASH_AI_URL")
    .option("--token <token>", "override DASH_AI_TOKEN")
    .action(async (id, opts) => {
      const ctx = getContext(opts)
      try {
        const { client, embedded } = await resolveClient(ctx)
        try {
          if (opts.file) {
            const doc = await client.get<PlanDocResponse>(`/api/tasks/${id}/plan-doc?file=${opts.file}`)
            if (ctx.json) {
              console.log(JSON.stringify({ success: true, data: { taskId: id, file: doc.file, content: doc.content } }, null, 2))
            } else if (opts.stdout) {
              process.stdout.write(doc.content + "\n")
            } else {
              console.log(chalk.bold(`=== ${doc.file} ===`))
              console.log(doc.content)
            }
          } else {
            // List available files
            if (!ctx.quiet) console.log(chalk.bold("Available plan documents:"))
            for (const file of ["BRIEF.md", "ROADMAP.md", "ISSUES.md"]) {
              try {
                await client.get(`/api/tasks/${id}/plan-doc?file=${file}`)
                if (ctx.json) {
                  console.log(JSON.stringify({ success: true, data: { taskId: id, file } }, null, 2))
                } else {
                  console.log(`  ${file}`)
                }
              } catch {
                // File not available — skip
              }
            }
            if (!ctx.json && !ctx.quiet) {
              console.log(`\nUse --file <name> to read a specific document.`)
            }
          }
        } finally {
          if (embedded) {
            const { teardownEmbeddedServer } = await import("../embedded/server")
            await teardownEmbeddedServer()
          }
        }
      } catch (err) { handleError(err) }
    })

  // ─── APPROVE-PLAN ──────────────────────────────────────────────────────────
  tasks
    .command("approve-plan <id>")
    .description("Mark a planned task as ready to code")
    .option("--json", "output as JSON")
    .option("--quiet", "suppress non-essential output")
    .option("--no-color", "disable color output")
    .option("--url <url>", "override DASH_AI_URL")
    .option("--token <token>", "override DASH_AI_TOKEN")
    .action(async (id, opts) => {
      const ctx = getContext(opts)
      try {
        const { client, embedded } = await resolveClient(ctx)
        try {
          const task = await client.get<Task>(`/api/tasks/${id}`)
          if (task.status !== "PLANNED") {
            printError(ctx, `Task must be PLANNED. Current: ${task.status}`, 1)
          }
          await client.patch(`/api/tasks/${id}/status`, { status: "READY_TO_CODE" })
          if (!ctx.quiet) printSuccess(ctx, "Task marked READY_TO_CODE — queue will pick it up shortly.")
        } finally {
          if (embedded) {
            const { teardownEmbeddedServer } = await import("../embedded/server")
            await teardownEmbeddedServer()
          }
        }
      } catch (err) { handleError(err) }
    })

  // ─── DIFF ──────────────────────────────────────────────────────────────────
  tasks
    .command("diff <id>")
    .description("Show the diff from a completed coding session")
    .option("--stdout", "pipe raw diff to stdout")
    .option("--json", "output as JSON with stats")
    .option("--quiet", "suppress non-essential output")
    .option("--no-color", "disable color output")
    .option("--url <url>", "override DASH_AI_URL")
    .option("--token <token>", "override DASH_AI_TOKEN")
    .action(async (id, opts) => {
      const ctx = getContext(opts)
      try {
        const { client, embedded } = await resolveClient(ctx)
        try {
          const diff = await client.get<string>(`/api/tasks/${id}/diff`)

          if (opts.stdout) {
            process.stdout.write(diff)
          } else if (ctx.json) {
            const stats = computeDiffStats(diff)
            console.log(JSON.stringify({ success: true, data: { taskId: id, diff, stats } }, null, 2))
          } else {
            console.log(chalk.bold(`=== Diff for ${id} ===\n`))
            console.log(diff || chalk.gray("(no changes)"))
          }
        } finally {
          if (embedded) {
            const { teardownEmbeddedServer } = await import("../embedded/server")
            await teardownEmbeddedServer()
          }
        }
      } catch (err) { handleError(err) }
    })

  // ─── REVIEW ────────────────────────────────────────────────────────────────
  tasks
    .command("review <id>")
    .description("Run reviewer persona on completed coding session")
    .option("--persona <name>", "reviewer persona name")
    .option("--json", "output as JSON")
    .option("--quiet", "suppress non-essential output")
    .option("--no-color", "disable color output")
    .option("--url <url>", "override DASH_AI_URL")
    .option("--token <token>", "override DASH_AI_TOKEN")
    .action(async (id, opts) => {
      const ctx = getContext(opts)
      try {
        const { client, embedded } = await resolveClient(ctx)
        const body: Record<string, unknown> = {}
        if (opts.persona) {
          // Look up persona ID by name
          const personas = await client.get<{ id: string }[]>("/api/personas?activeOnly=false")
          const found = personas.find((p) => p.id === opts.persona || (p as any).name === opts.persona)
          if (found) body.personaId = found.id
        }

        const result = await client.post<{
          taskId: string
          review: {
            summary: string
            filesChanged: number
            linesAdded: number
            linesRemoved: number
            matchesPlan: boolean
            concerns: string[]
          }
        }>(`/api/tasks/${id}/review`, body)

        if (embedded) {
          const { teardownEmbeddedServer } = await import("../embedded/server")
          await teardownEmbeddedServer()
        }

        if (ctx.json) {
          console.log(JSON.stringify({ success: true, data: result }, null, 2))
        } else {
          console.log(chalk.bold("Review Summary"))
          console.log(result.review.summary)
          console.log()
          console.log(`  Files: ${result.review.filesChanged}  |  +${result.review.linesAdded}  |  -${result.review.linesRemoved}`)
          console.log(`  Matches plan: ${result.review.matchesPlan ? chalk.green("Yes") : chalk.red("No")}`)
          if (result.review.concerns.length) {
            console.log()
            console.log(chalk.yellow("Concerns:"))
            result.review.concerns.forEach((c) => console.log(`  - ${c}`))
          }
        }
      } catch (err) { handleError(err) }
    })

  // ─── APPROVE / REJECT ──────────────────────────────────────────────────────
  tasks
    .command("approve <id>")
    .description("Approve a task after review")
    .option("--note <text>", "approval note")
    .option("--json", "output as JSON")
    .option("--quiet", "suppress non-essential output")
    .option("--no-color", "disable color output")
    .option("--url <url>", "override DASH_AI_URL")
    .option("--token <token>", "override DASH_AI_TOKEN")
    .action(async (id, opts) => {
      const ctx = getContext(opts)
      try {
        const { client, embedded } = await resolveClient(ctx)
        try {
          await client.patch(`/api/tasks/${id}/status`, {
            status: "APPROVED",
            reviewNote: opts.note,
          })
          if (!ctx.quiet) printSuccess(ctx, `Task ${id.slice(0, 8)} approved.`)
        } finally {
          if (embedded) {
            const { teardownEmbeddedServer } = await import("../embedded/server")
            await teardownEmbeddedServer()
          }
        }
      } catch (err) { handleError(err) }
    })

  tasks
    .command("reject <id>")
    .description("Reject a task after review")
    .requiredOption("--reason <text>", "reason for rejection")
    .option("--json", "output as JSON")
    .option("--quiet", "suppress non-essential output")
    .option("--no-color", "disable color output")
    .option("--url <url>", "override DASH_AI_URL")
    .option("--token <token>", "override DASH_AI_TOKEN")
    .action(async (id, opts) => {
      const ctx = getContext(opts)
      try {
        const { client, embedded } = await resolveClient(ctx)
        try {
          await client.patch(`/api/tasks/${id}/status`, {
            status: "REJECTED",
            reviewNote: opts.reason,
          })
          if (!ctx.quiet) printSuccess(ctx, `Task ${id.slice(0, 8)} rejected.`)
          if (!ctx.quiet) console.log(chalk.gray(`  Reason: ${opts.reason}`))
        } finally {
          if (embedded) {
            const { teardownEmbeddedServer } = await import("../embedded/server")
            await teardownEmbeddedServer()
          }
        }
      } catch (err) { handleError(err) }
    })

  // ─── WAIT ─────────────────────────────────────────────────────────────────
  tasks
    .command("wait <id>")
    .description("Wait for a task to reach a terminal state")
    .option("--timeout <seconds>", "max wait time (default: 1200)", "1200")
    .option("--status <status>", "wait for specific status")
    .option("--json", "output as JSON")
    .option("--quiet", "suppress non-essential output")
    .option("--no-color", "disable color output")
    .option("--url <url>", "override DASH_AI_URL")
    .option("--token <token>", "override DASH_AI_TOKEN")
    .action(async (id, opts) => {
      const ctx = getContext(opts)
      try {
        const { client, embedded } = await resolveClient(ctx)
        try {
          const targetStatuses = opts.status ? [opts.status] : ["PLANNED", "AWAITING_REVIEW", "APPROVED", "REJECTED", "COMPLETE", "FAILED"]
          const timeoutMs = parseInt(opts.timeout) * 1000

          if (!ctx.quiet) {
            const { default: ora } = await import("ora")
            ora(`Waiting for ${id.slice(0, 8)} (${targetStatuses.join(" | ")})...`).start()
          }

          const task = await pollTaskStatus(client, id, {
            targetStatus: targetStatuses,
            timeoutMs,
          })

          if (ctx.json) {
            console.log(JSON.stringify({
              success: true,
              data: {
                taskId: task.id,
                status: task.status,
                planPath: task.planPath,
                diffPath: task.diffPath,
                errorMessage: task.errorMessage,
                completedAt: task.completedAt,
              },
            }, null, 2))
          } else {
            printSuccess(ctx, `Task is now ${task.status}`)
          }

          process.exit(task.status === "FAILED" ? 6 : 0)
        } finally {
          if (embedded) {
            const { teardownEmbeddedServer } = await import("../embedded/server")
            await teardownEmbeddedServer()
          }
        }
      } catch (err) {
        if (err instanceof Error && err.message.includes("timed out")) {
          printError(ctx, err.message, 1)
        }
        handleError(err)
      }
    })

  // ─── WATCH ─────────────────────────────────────────────────────────────────
  tasks
    .command("watch <id>")
    .description("Stream live events for a running task")
    .option("--follow", "keep watching after task completes", false)
    .option("--json", "output as NDJSON (newline-delimited JSON)")
    .option("--no-color", "disable color output")
    .option("--url <url>", "override DASH_AI_URL")
    .option("--token <token>", "override DASH_AI_TOKEN")
    .action(async (id, opts) => {
      const ctx = getContext(opts)
      const { client } = await resolveClient(ctx)

      // Get task status first
      const task = await client.get<Task>(`/api/tasks/${id}`)
      const terminal = ["PLANNED", "AWAITING_REVIEW", "APPROVED", "REJECTED", "COMPLETE", "FAILED"]
      if (terminal.includes(task.status)) {
        if (!ctx.quiet) console.log(chalk.gray(`Task is already ${task.status} — nothing to watch.`))
        return
      }

      // Build WebSocket URL from HTTP URL
      const wsUrl = (ctx.url || process.env.DASH_AI_URL || "http://localhost:3000")
        .replace(/^http/, "ws") + `/ws/tasks/${id}/stream`

      const ws = new WebSocket(wsUrl, {
        headers: { Authorization: `Bearer ${ctx.token || process.env.DASH_AI_TOKEN || ""}` },
      })

      ws.on("message", (data) => {
        const event = JSON.parse(data.toString())
        if (ctx.json) {
          process.stdout.write(JSON.stringify(event) + "\n")
        } else {
          renderEvent(event)
        }
      })

      ws.on("close", () => {
        if (!opts.follow) {
          console.log(chalk.gray("\nSession ended."))
          process.exit(0)
        }
      })

      ws.on("error", (err) => {
        printError(ctx, `WebSocket error: ${err.message}`, 1)
      })

      process.on("SIGINT", () => {
        ws.close()
        console.log(chalk.gray("\nStopped watching. Task continues running server-side."))
        process.exit(0)
      })
    })
}

// ─── Helpers ──────────────────────────────────────────────────────────────────

function handleError(err: unknown): never {
  if (err instanceof ApiError) {
    process.stderr.write(chalk.red(`Error: ${err.message}\n`))
    process.exit(err.code)
  }
  const msg = err instanceof Error ? err.message : String(err)
  process.stderr.write(chalk.red(`Error: ${msg}\n`))
  process.exit(1)
}

function formatStatus(status: string, ctx: CliContext): string {
  const colors: Record<string, (s: string) => string> = {
    DRAFT: (s) => chalk.gray(s),
    IN_PLANNING: (s) => chalk.blue(s),
    PLANNED: (s) => chalk.cyan(s),
    QUEUED: (s) => chalk.yellow(s),
    READY_TO_CODE: (s) => chalk.magenta(s),
    RUNNING: (s) => chalk.blue.bold(s),
    AWAITING_REVIEW: (s) => chalk.yellow(s),
    APPROVED: (s) => chalk.green(s),
    REJECTED: (s) => chalk.red(s),
    COMPLETE: (s) => chalk.green(s),
    FAILED: (s) => chalk.red(s),
  }
  return (colors[status] ?? ((s: string) => s))(status)
}

function printTask(task: Task, ctx: CliContext): void {
  console.log(chalk.bold(`Task: ${task.title}`))
  console.log(`  ID:        ${task.id}`)
  console.log(`  Status:    ${formatStatus(task.status, ctx)}`)
  console.log(`  Priority:  ${task.priority ?? "—"}`)
  if ((task as any).projectName) console.log(`  Project:  ${(task as any).projectName}`)
  if (task.planPath) console.log(`  Plan:      ${task.planPath}`)
  if (task.diffPath) console.log(`  Diff:      ${task.diffPath}`)
  if (task.sessionId) console.log(`  Session:   ${task.sessionId}`)
  if (task.errorMessage) console.log(`  Error:     ${chalk.red(task.errorMessage)}`)
  if (task.startedAt) console.log(`  Started:   ${relativeTime(task.startedAt as unknown as string)}`)
  if (task.completedAt) console.log(`  Completed: ${relativeTime(task.completedAt as unknown as string)}`)
  if (task.createdAt) console.log(`  Created:   ${relativeTime(task.createdAt as unknown as string)}`)
}

function renderEvent(event: Record<string, unknown>): void {
  switch (event.eventType || event.type) {
    case "PLANNING_EVENT":
    case "CODING_EVENT": {
      const status = event.payload && typeof event.payload === "object" ? (event.payload as any).status : null
      const message = event.payload && typeof event.payload === "object" ? (event.payload as any).message : null
      if (status === "starting") console.log(chalk.blue(`⏳ ${message || "Starting..."}`))
      else if (status === "completed") console.log(chalk.green(`✓ ${message || "Complete"}`))
      else if (status === "running" || status === "launching") console.log(chalk.blue(`… ${message || status}`))
      break
    }
    case "PLANNING_TEXT":
    case "CODING_TEXT": {
      const delta = event.payload && typeof event.payload === "object" ? (event.payload as any).delta : ""
      process.stdout.write(chalk.gray(delta as string))
      break
    }
    case "TOOL_START": {
      const toolName = event.payload && typeof event.payload === "object" ? (event.payload as any).toolName : ""
      const args = event.payload && typeof event.payload === "object" ? (event.payload as any).args : {}
      const argsStr = typeof args === "object" ? JSON.stringify(args).slice(0, 60) : String(args)
      console.log(chalk.cyan(`  → ${toolName}`), chalk.gray(truncate(argsStr, 60)))
      break
    }
    case "TOOL_END": {
      const toolName = event.payload && typeof event.payload === "object" ? (event.payload as any).toolName : ""
      const isError = event.payload && typeof event.payload === "object" ? (event.payload as any).isError : false
      if (isError) console.log(chalk.red(`  ✗ ${toolName} (error)`))
      else console.log(chalk.green(`  ✓ ${toolName}`))
      break
    }
    case "TURN_START": {
      const turnIndex = event.payload && typeof event.payload === "object" ? (event.payload as any).turnIndex : 0
      console.log(chalk.bold(`--- Turn ${turnIndex} ---`))
      break
    }
    case "TURN_END":
      console.log()
      break
    case "ERROR": {
      const msg = event.payload && typeof event.payload === "object" ? (event.payload as any).message : ""
      console.log(chalk.red(`⚠ ${msg}`))
      break
    }
  }
}

function computeDiffStats(diff: string): { filesChanged: number; linesAdded: number; linesRemoved: number } {
  let filesChanged = 0
  let linesAdded = 0
  let linesRemoved = 0
  const lines = diff.split("\n")
  for (const line of lines) {
    if (line.startsWith("+++") || line.startsWith("---")) filesChanged++
    if (line.startsWith("+") && !line.startsWith("+++")) linesAdded++
    if (line.startsWith("-") && !line.startsWith("---")) linesRemoved++
  }
  return { filesChanged: Math.ceil(filesChanged / 2), linesAdded, linesRemoved }
}
