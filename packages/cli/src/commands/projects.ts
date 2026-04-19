import chalk from "chalk"
import { createInterface } from "readline"
import { Command } from "commander"
import { resolveClient, withClient } from "../api/resolver"
import { getContext, type CliContext } from "../context"
import { printOutput, formatTable, printError } from "../output/format"
import { ApiError } from "../api/client"

export interface Project {
  id: string
  name: string
  description: string
  path: string
  isActive: boolean
  createdAt: string
  updatedAt: string
}

export function registerProjectCommands(program: Command): void {
  const projects = program.command("projects").description("Manage projects")

  projects
    .command("list")
    .description("List all projects")
    .option("--active-only", "show active projects only", false)
    .option("--json", "output as JSON")
    .option("--quiet", "suppress non-essential output")
    .option("--no-color", "disable color output")
    .option("--url <url>", "override DASH_AI_URL")
    .option("--token <token>", "override DASH_AI_TOKEN")
    .action(async (opts) => {
      const ctx = getContext(opts)
      try {
        const projects = await withClient(ctx, async (client) => {
          const params = new URLSearchParams()
          params.set("activeOnly", String(opts.activeOnly))
          return client.get<Project[]>(`/api/projects?${params}`)
        })

        if (ctx.json) {
          console.log(JSON.stringify({ success: true, data: { projects } }, null, 2))
        } else if (projects.length === 0) {
          console.log(chalk.gray("No projects found."))
        } else {
          console.log(
            formatTable(
              ["ID", "Name", "Path", "Active", "Updated"],
              projects.map((p) => [
                p.id.slice(0, 8),
                p.name,
                p.path,
                p.isActive ? chalk.green("✓") : chalk.gray("—"),
                p.updatedAt ? p.updatedAt.split("T")[0] : "—",
              ])
            )
          )
        }
      } catch (err) {
        handleError(err, ctx)
      }
    })

  projects
    .command("add")
    .description("Register a new project")
    .requiredOption("--name <name>", "project name")
    .requiredOption("--path <path>", "repo path (supports ~)")
    .option("--description <desc>", "project description")
    .option("--json", "output as JSON")
    .option("--quiet", "suppress non-essential output")
    .option("--no-color", "disable color output")
    .option("--url <url>", "override DASH_AI_URL")
    .option("--token <token>", "override DASH_AI_TOKEN")
    .action(async (opts) => {
      const ctx = getContext(opts)
      try {
        const project = await withClient(ctx, async (client) => {
          return client.post<Project>("/api/projects", {
            name: opts.name,
            path: opts.path.replace(/^~/, process.env.HOME || ""),
            description: opts.description || "",
          })
        })

        if (ctx.json) {
          console.log(JSON.stringify({ success: true, data: { project } }, null, 2))
        } else {
          console.log(chalk.green("✓"), `Project created: ${project.name}`)
          console.log(`  ID:   ${project.id}`)
          console.log(`  Path: ${project.path}`)
        }
      } catch (err) {
        handleError(err, ctx)
      }
    })

  projects
    .command("show <id>")
    .description("Show project details")
    .option("--json", "output as JSON")
    .option("--quiet", "suppress non-essential output")
    .option("--no-color", "disable color output")
    .option("--url <url>", "override DASH_AI_URL")
    .option("--token <token>", "override DASH_AI_TOKEN")
    .action(async (id, opts) => {
      const ctx = getContext(opts)
      try {
        const project = await withClient(ctx, async (client) => {
          return client.get<Project>(`/api/projects/${id}`)
        })

        if (ctx.json) {
          console.log(JSON.stringify({ success: true, data: { project } }, null, 2))
        } else {
          console.log(chalk.bold(`Project: ${project.name}`))
          console.log(`  ID:          ${project.id}`)
          console.log(`  Path:        ${project.path}`)
          console.log(`  Description: ${project.description || "—"}`)
          console.log(`  Active:      ${project.isActive ? chalk.green("Yes") : chalk.gray("No")}`)
          console.log(`  Created:     ${project.createdAt.split("T")[0]}`)
          console.log(`  Updated:     ${project.updatedAt.split("T")[0]}`)
        }
      } catch (err) {
        handleError(err, ctx)
      }
    })

  projects
    .command("remove <id>")
    .description("Delete a project (prompts for confirmation)")
    .option("-y, --yes", "skip confirmation")
    .option("--json", "output as JSON")
    .option("--quiet", "suppress non-essential output")
    .option("--no-color", "disable color output")
    .option("--url <url>", "override DASH_AI_URL")
    .option("--token <token>", "override DASH_AI_TOKEN")
    .action(async (id, opts) => {
      const ctx = getContext(opts)

      // Resolve project name for the prompt
      let projectName = id
      try {
        const project = await withClient(ctx, async (client) =>
          client.get<Project>(`/api/projects/${id}`)
        )
        projectName = project.name
      } catch {
        // ignore — will fail on delete if not found
      }

      // Confirm if not --yes
      if (!opts.yes) {
        const rl = createInterface({ input: process.stdin, output: process.stdout })
        const answer = await new Promise<string>((res) =>
          rl.question(`Really delete project '${projectName}'? [y/N] `, (a) => {
            rl.close()
            res(a.trim().toLowerCase())
          })
        )
        if (answer !== "y" && answer !== "yes") {
          console.log("Aborted.")
          process.exit(0)
        }
      }

      try {
        await withClient(ctx, async (client) => {
          return client.delete(`/api/projects/${id}`)
        })
        if (!ctx.quiet) console.log(chalk.green("✓"), `Project deleted.`)
      } catch (err) {
        handleError(err, ctx)
      }
    })
}

function handleError(err: unknown, _ctx?: CliContext): never {
  if (err instanceof ApiError) {
    process.stderr.write(chalk.red(`Error: ${err.message}\n`))
    process.exit(err.code)
  }
  const msg = err instanceof Error ? err.message : String(err)
  process.stderr.write(chalk.red(`Error: ${msg}\n`))
  process.exit(1)
}
