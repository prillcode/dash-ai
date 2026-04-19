# Roadmap — DA-02 Dash AI CLI

## Phase 01 — CLI Scaffold + Embedded Server Bootstrap
**Objective:** Create the `packages/cli/` package with command framework, embedded server startup, and shared module access
**Status:** ✅ Complete
**Outputs:**
- `packages/cli/` package with commander/yargs CLI framework
- `dash-ai --help` working with all subcommand stubs
- Embedded server bootstrap: in-process Hono + SQLite + Pi SDK init
- Thin API client: HTTP client for remote Dash AI server
- Output formatting: table renderer + `--json` support
- `pnpm build` passes across server + cli

## Phase 02 — Task CRUD Commands
**Objective:** Implement read-only and data-manipulation commands that work against both embedded and remote servers
**Status:** ✅ Complete
**Outputs:**
- `dash-ai projects list/add/show/remove`
- `dash-ai tasks list/show/create/update`
- `dash-ai config list/set`
- All commands with `--json` output
- Thin client mode connects to remote server via `DASH_AI_URL` + `DASH_AI_TOKEN`
- Embedded mode spins up server transparently when no remote is configured

## Phase 03 — Plan & Code Trigger Commands
**Objective:** Implement commands that trigger agent execution (planning, coding, review)
**Status:** ✅ Complete
**Outputs:**
- `dash-ai tasks plan <id>` — triggers embedded Pi SDK planning session
- `dash-ai tasks plan <id> --feedback "..."` — iterate with feedback
- `dash-ai tasks plan-docs <id>` — read plan docs (BRIEF, ROADMAP, phase plans)
- `dash-ai tasks approve-plan <id>` — mark ready for coding queue
- `dash-ai tasks diff <id>` — show coding session diff
- `dash-ai tasks review <id>` — run reviewer persona
- `dash-ai tasks approve/reject <id>` — finalize task
- Embedded runner: wraps planningRunner + codingRunner for CLI context
- Queue worker runs in embedded mode for coding tasks

## Phase 04 — Watch Command (Live Events)
**Objective:** Stream real-time agent events to the terminal during planning/coding sessions
**Status:** ✅ Complete
**Outputs:**
- `dash-ai tasks watch <id>` — connects to event stream, renders in terminal
- Shows: tool calls, text output, thinking blocks, turn progress
- Formatting: colored terminal output with tool name headers
- `--json` mode: newline-delimited JSON events for agent consumers
- Works via WebSocket against running server (thin client mode)
- Graceful exit on Ctrl+C, session continues running server-side

## Phase 05 — Agent Consumer Features
**Objective:** Polish the CLI for first-class AI agent consumption
**Status:** ✅ Complete
**Outputs:**
- `dash-ai tasks wait <id> --timeout <seconds>` — block until terminal state
- `dash-ai tasks plan-docs <id> --stdout` — pipe docs to stdout for agent context
- `dash-ai tasks diff <id> --stdout` — pipe raw diff to stdout
- Structured JSON output for all commands with consistent schema
- `dash-ai tasks create --auto-plan` — create + immediately start planning
- Reviewer persona: runs post-coding, returns structured summary in JSON
- Exit codes properly set for script/agent consumption
- Documentation: CLI reference for agent integrators

## V2 (Deferred)
- `dash-ai run` — end-to-end one-liner (create → plan → approve → code → review → return)
- `dash-ai serve` — daemon mode (background server process)
- `dash-ai tasks create --wait` — create and wait for full pipeline
- Interactive TUI with ink (optional)

## Notes
- Phase 01-02 are prerequisite infrastructure — no agent execution yet
- Phase 03 is the first "magic" phase — actual Pi SDK sessions fire from CLI
- Phase 04 adds the human-facing UX payoff (watching agents work in real time)
- Phase 05 is the agent-facing payoff (programmatic consumption)
- All phases depend on DA-01 Phases 01-02 being complete
- Plans live in `phases/`
- Use `/skill:start-work-plan` to deepen a phase when needed
- Use `/skill:start-work-run` to execute a plan when ready
