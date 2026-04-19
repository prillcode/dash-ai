#!/usr/bin/env node
import { Command } from "commander"
import { registerProjectCommands } from "./commands/projects.js"
import { registerTaskCommands } from "./commands/tasks.js"
import { registerConfigCommands } from "./commands/config.js"
import { registerPersonaCommands } from "./commands/personas.js"

const program = new Command()
  .name("dash-ai")
  .description("AI-powered task orchestration for coding projects")
  .version("0.1.0")
  .option("--json", "output as JSON")
  .option("--quiet", "suppress non-essential output")
  .option("--no-color", "disable color output")
  .option("--url <url>", "override DASH_AI_URL (or set DASH_AI_URL env var)")
  .option("--token <token>", "override DASH_AI_TOKEN (or set DASH_AI_TOKEN env var)")

registerProjectCommands(program)
registerTaskCommands(program)
registerPersonaCommands(program)
registerConfigCommands(program)

program.parse()
