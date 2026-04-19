import chalk from "chalk"
import { Command } from "commander"

export function registerConfigCommands(program: Command): void {
  const config = program
    .command("config")
    .description("Show and manage CLI configuration")

  config
    .command("list")
    .description("Show current configuration")
    .action(() => {
      const url = process.env.DASH_AI_URL
      const token = process.env.DASH_AI_TOKEN
      const apiToken = process.env.API_TOKEN

      const dashUrl = url ? chalk.green(url) : chalk.gray("(not set - embedded mode)")
      const dashToken = token ? chalk.green(token.slice(0, 8) + "...") : chalk.gray("(not set)")
      const apiTok = apiToken ? chalk.green("***") : chalk.gray("(defaults to dev-token)")

      console.log(chalk.bold("Dash AI CLI Configuration\n"))
      console.log("  DASH_AI_URL     " + dashUrl)
      console.log("  DASH_AI_TOKEN  " + dashToken)
      console.log("  API_TOKEN       " + apiTok)
      console.log()
      console.log("  Run with --url and --token flags to override for a single command.")
    })
}
