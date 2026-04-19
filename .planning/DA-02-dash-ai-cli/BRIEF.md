# DA-02 — Dash AI CLI

## Type
Feature

## Objective
Build a standalone `dash-ai` CLI that embeds the full Dash AI engine (Hono + SQLite + Pi SDK) and provides terminal access to task planning, coding, and review — for both human operators and AI agent consumers. The CLI is the headless engine that the Electron app will later wrap with a GUI.

## Background
Dash AI currently has a web dashboard (React + Hono server) and spawns `opencode-cli` for agent execution. After DA-01 rewrites the runners to use the Pi SDK, all agent execution will be in-process. This unlocks a standalone CLI where `dash-ai` is a single binary that:

- Embeds the Hono server + SQLite database + Pi SDK session management
- Provides a `git`-style subcommand interface for task lifecycle management
- Streams live agent events to the terminal during planning/coding sessions
- Returns structured JSON output for AI agent consumers

The CLI serves two audiences:
1. **Human operators** — developers who want terminal access to Dash AI alongside (or instead of) the GUI. They might be working in `pi`, Claude Code, or any other tool and want to delegate structured work without context-switching.
2. **AI agent consumers** — any coding agent that can run shell commands. An agent in `pi` can call `dash-ai tasks create ...` or `dash-ai run ...` to delegate work to Dash AI's planning and coding personas, then consume the results programmatically.

## Operating Modes

### Embedded mode (default for execution commands)
Commands that run agent sessions (`plan`, `run`) spin up an in-process Hono server + Pi SDK session. The embedded server:
- Uses the same SQLite database at `~/.dash-ai/dashboard.db`
- Initializes Pi `AuthStorage` + `ModelRegistry` in-process
- Manages concurrent sessions via the same queue worker logic
- Tears down cleanly when the command completes

### Thin client mode (for API-only commands)
Commands that are pure data operations (`list`, `status`, `diff`, `approve`) can work against any running Dash AI instance:
- `DASH_AI_URL` + `DASH_AI_TOKEN` env vars point to remote server
- Falls back to embedded mode if no remote is configured (spins up server, runs command, tears down)
- This means the CLI works identically against the Electron app's server or a standalone daemon

### Hybrid behavior
```
dash-ai tasks list          → thin client (read-only, no engine needed)
dash-ai tasks diff <id>     → thin client
dash-ai tasks plan <id>     → embedded (runs Pi SDK session)
dash-ai tasks watch <id>    → thin client (streams from running server)
dash-ai run                 → embedded (full pipeline)
```

## Scope
- `packages/cli/` in the monorepo, published as `@dash-ai/cli`
- Subcommand structure: `projects`, `tasks`, `run`
- Embedded server bootstrap for execution commands
- Thin client mode for read/CRUD commands
- Live event streaming via `watch` command
- `--json` output for all commands (machine-parseable)
- Reviewer persona integration for post-coding review
- V1: task CRUD + plan/code triggers + watch + diff
- V2: `dash-ai run` end-to-end one-liner (tracked in roadmap, planned separately)

## Out of Scope
- `dash-ai run` end-to-end command (V2 — deferred)
- Interactive TUI (e.g., ink-based terminal UI) — plain text output only
- Config wizard / first-run setup flow
- Auto-update mechanism
- Remote server management (`dash-ai serve` as a daemon — the Electron app covers this)

## Relevant Files (new)
- `packages/cli/src/index.ts` — CLI entry point (commander or yargs)
- `packages/cli/src/commands/tasks.ts` — task subcommands
- `packages/cli/src/commands/projects.ts` — project subcommands
- `packages/cli/src/commands/watch.ts` — live event streaming
- `packages/cli/src/embedded/server.ts` — embedded Hono server bootstrap
- `packages/cli/src/embedded/runner.ts` — embedded Pi SDK session runner
- `packages/cli/src/api/client.ts` — thin API client for remote server
- `packages/cli/src/output/format.ts` — table/JSON formatting

## Relevant Files (existing, shared)
- `packages/server/src/agent/planningRunner.ts` — reused by embedded runner
- `packages/server/src/agent/codingRunner.ts` — reused by embedded runner
- `packages/server/src/agent/piSession.ts` — reused by embedded runner
- `packages/server/src/services/taskService.ts` — reused directly
- `packages/server/src/services/personaService.ts` — reused directly
- `packages/server/src/services/projectService.ts` — reused directly
- `packages/server/src/services/queueWorker.ts` — adapted for embedded mode
- `packages/server/src/db/schema.ts` — shared schema
- `packages/server/src/routes/tasks.ts` — API contract reference
- `packages/server/src/routes/personas.ts` — API contract reference
- `packages/server/src/routes/projects.ts` — API contract reference

## Persona Architecture

The CLI exposes the three persona types:

| Persona | Role | When invoked |
|---------|------|-------------|
| **Planner** | Runs `start-work-begin` + `start-work-plan` | `dash-ai tasks plan <id>` |
| **Coder** | Runs `start-work-run` | Queue picks up after plan approval |
| **Reviewer** | Reviews diff, produces summary | `dash-ai tasks review <id>` (new command) |

The Reviewer persona is new. It runs after a coding session completes, before human review. It produces:
- A structured summary of changes (files modified, lines added/removed)
- An assessment of whether the changes match the plan
- Any concerns or issues spotted

For agent consumers, the reviewer output is returned alongside the diff in JSON mode, giving the calling agent context to decide whether to approve or reject.

## Command Reference

### Projects
```bash
dash-ai projects list [--json]
dash-ai projects add --name <name> --path <path> [--json]
dash-ai projects show <id> [--json]
dash-ai projects remove <id>
```

### Tasks — CRUD
```bash
dash-ai tasks list [--status <status>] [--project <name>] [--json]
dash-ai tasks create --project <name> --title <title> [--description <desc>] [--planner <persona>] [--coder <persona>] [--json]
dash-ai tasks show <id> [--json]
dash-ai tasks update <id> [--title <title>] [--description <desc>]
```

### Tasks — Planning
```bash
dash-ai tasks plan <id>                              # trigger planning (DRAFT → IN_PLANNING → PLANNED)
dash-ai tasks plan <id> --feedback "needs more..."   # iterate with feedback
dash-ai tasks plan-docs <id> [--file BRIEF|ROADMAP|<phase-plan>]  # read plan docs
dash-ai tasks plan-docs <id> --stdout                # pipe to stdout for agent consumption
dash-ai tasks approve-plan <id>                      # PLANNED → READY_TO_CODE
```

### Tasks — Coding & Review
```bash
dash-ai tasks diff <id> [--stdout]                   # show diff, or pipe raw diff to stdout
dash-ai tasks review <id> [--json]                   # run reviewer persona, get summary
dash-ai tasks approve <id> [--note "looks good"]
dash-ai tasks reject <id> --reason "..."
```

### Tasks — Monitoring
```bash
dash-ai tasks watch <id>                             # stream live events to terminal
dash-ai tasks logs <id>                              # show session log
dash-ai tasks wait <id> [--timeout <seconds>]        # block until task reaches terminal state
```

### Configuration
```bash
dash-ai config list                                  # show current config
dash-ai config set <key> <value>
```

### Global Flags
```
--json            machine-parseable output
--quiet           suppress all non-essential output
--url <url>       override DASH_AI_URL
--token <token>   override DASH_AI_TOKEN
--no-color        disable color output
```

## Exit Codes

| Code | Meaning |
|------|---------|
| 0 | Success |
| 1 | General error |
| 2 | Invalid arguments |
| 3 | Not found (task, project, persona) |
| 4 | Auth error (invalid/expired token) |
| 5 | Server unreachable (thin client mode) |
| 6 | Task failed (for `plan`, `wait` commands) |

## Context
- Prerequisite: DA-01 Phases 01-02 (Pi SDK runner rewrite + persona/model integration) must be complete
- Branch: `main` (planning only — branch created before execution)
- Related work: DA-01 (Phases 03-05 deferred until after CLI)

## Success Criteria
- [ ] `npm install -g @dash-ai/cli` works and `dash-ai --help` prints usage
- [ ] `dash-ai tasks create` + `dash-ai tasks plan` triggers a full planning session via embedded Pi SDK
- [ ] `dash-ai tasks watch` streams live agent events to the terminal
- [ ] `dash-ai tasks diff` shows the coding session diff
- [ ] `dash-ai tasks review` runs a reviewer persona and outputs a structured summary
- [ ] All commands support `--json` with complete, typed output
- [ ] Thin client mode works against a running Dash AI server (Electron or standalone)
- [ ] Embedded mode works standalone with no external server required
- [ ] `pnpm build` passes across all three packages (server, client, cli)
