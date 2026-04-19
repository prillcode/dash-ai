import chalk from "chalk"
import { Command } from "commander"
import { withClient } from "../api/resolver"
import { getContext } from "../context"
import { formatTable } from "../output/format"
import { ApiError } from "../api/client"

export interface Persona {
  id: string
  name: string
  description: string
  personaType: string
  model: string
  provider: string
  systemPrompt: string
  isActive: boolean
  createdAt: string
  updatedAt: string
}

export function registerPersonaCommands(program: Command): void {
  const personas = program.command("personas").description("List and show personas")

  personas
    .command("list")
    .description("List all active personas")
    .option("--json", "output as JSON")
    .option("--no-color", "disable color output")
    .option("--url <url>", "override DASH_AI_URL")
    .option("--token <token>", "override DASH_AI_TOKEN")
    .action(async (opts) => {
      const ctx = getContext(opts)
      try {
        const list = await withClient(ctx, async (client) => {
          return client.get<Persona[]>("/api/personas?activeOnly=false")
        })

        if (ctx.json) {
          console.log(JSON.stringify({ success: true, data: { personas: list } }, null, 2))
        } else if (list.length === 0) {
          console.log(chalk.gray("No personas found."))
        } else {
          console.log(
            formatTable(
              ["ID", "Name", "Type", "Model", "Provider", "Active"],
              list.map((p) => [
                p.id.slice(0, 8),
                p.name,
                p.personaType,
                p.model,
                p.provider,
                p.isActive ? chalk.green("✓") : chalk.gray("—"),
              ])
            )
          )
        }
      } catch (err) {
        if (err instanceof ApiError) {
          process.stderr.write(chalk.red(`Error: ${err.message}\n`))
          process.exit(err.code)
        }
        process.exit(1)
      }
    })

  personas
    .command("show <id>")
    .description("Show persona details")
    .option("--json", "output as JSON")
    .option("--no-color", "disable color output")
    .option("--url <url>", "override DASH_AI_URL")
    .option("--token <token>", "override DASH_AI_TOKEN")
    .action(async (id, opts) => {
      const ctx = getContext(opts)
      try {
        const persona = await withClient(ctx, async (client) => {
          return client.get<Persona>(`/api/personas/${id}`)
        })

        if (ctx.json) {
          console.log(JSON.stringify({ success: true, data: { persona } }, null, 2))
        } else {
          console.log(chalk.bold(`Persona: ${persona.name}`))
          console.log(`  ID:          ${persona.id}`)
          console.log(`  Type:        ${persona.personaType}`)
          console.log(`  Provider:    ${persona.provider}`)
          console.log(`  Model:       ${persona.model}`)
          console.log(`  Description: ${persona.description || "—"}`)
          console.log(`  Active:      ${persona.isActive ? chalk.green("Yes") : chalk.gray("No")}`)
          console.log(`  Created:     ${persona.createdAt.split("T")[0]}`)
        }
      } catch (err) {
        if (err instanceof ApiError) {
          process.stderr.write(chalk.red(`Error: ${err.message}\n`))
          process.exit(err.code)
        }
        process.exit(1)
      }
    })
}
