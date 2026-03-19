# PRD: Dash AI Langchain

**Document purpose:** Handoff brief for a new Claude session to scaffold and build this project from scratch.

---

## Background & Context

This project is a **sibling to an existing project called Dash AI** (GitHub: `github.com/prillcode/dash-ai`), which is a self-hosted task queue dashboard for AI-assisted planning and coding workflows. Dash AI uses the **OpenCode SDK** and a skills-based agent system to run planning and coding sessions against tasks in a queue.

The goal of this new project — **Dash AI Langchain** — is to replicate the same core user workflow, but replace the OpenCode agent execution layer with the **Deep Agents CLI** (`deepagents-cli` Python package, built on LangGraph). The key insight is that the `deepagents-cli` supports a **headless mode** designed for scripting and CI — meaning it can be spawned as a child process directly from Node.js, with no Python HTTP server or additional services required.

The two projects are intentionally kept as **separate repos** because the two projects are expected to diverge in schema and runner logic over time, and the OpenCode vs. Deep Agents CLI execution models are fundamentally different.

---

## Reference: What Dash AI (OpenCode) Does

At a high level, Dash AI's workflow is:

1. User creates a **Task** (title, description, linked project, planning persona, coding persona)
2. Task enters `IN_PLANNING` — a planning agent runs, generates structured plan documents (`BRIEF.md`, `ROADMAP.md`, phased `PLAN.md` files) into the project's repo at `.planning/<planPath>/`
3. Task moves to `PLANNED` — user reviews the plan in the UI, can approve ("Mark Ready to Code") or iterate (submit feedback → back to `IN_PLANNING`)
4. Task moves to `READY_TO_CODE` → `QUEUED` → `RUNNING` — a coding agent executes the plan
5. Task moves to `AWAITING_REVIEW` — user approves or rejects the result
6. Task completes

Supporting entities:
- **Projects** — local repo paths on the machine running Dash AI
- **Personas** — named agent configs with a model + system prompt, typed as `planner`, `coder`, or `custom`

The UI is a React SPA with pages for Tasks, Projects, Personas, and a Monitor (live event log). The backend is Hono (TypeScript/Node.js) with SQLite via Drizzle ORM. A `queueWorker` polls the DB and dispatches planning/coding sessions.

For reference, the key files in Dash AI to study before building:
- `packages/server/src/opencode/` — OpenCode session wrappers (planning + coding runners)
- `packages/server/src/services/queueWorker.ts` — task queue polling and dispatch logic
- `packages/server/src/db/schema.ts` — full DB schema

---

## Architecture

### Core Insight: CLI as Subprocess (No Python Service)

The `deepagents-cli` supports **headless mode** designed for scripting and CI. This means the Hono `queueWorker` simply **spawns the CLI as a child process** — the same pattern Dash AI uses with OpenCode. There is no Python HTTP server, no FastAPI, no additional port, and no third PM2 process.

The Deep Agents CLI is filesystem-native (modeled after Claude Code). When given a `--cwd` path, the agent:
- Reads and writes files directly to that directory via `LocalFilesystemBackend`
- Offloads large conversation history to `/offloaded_history/` within the working directory
- Stores persistent memories at `~/.deepagents/<agent-name>/memories/` across sessions

So the planning agent writing `BRIEF.md`, `ROADMAP.md`, `PLAN.md` to `.planning/<planPath>/` is just the agent's natural filesystem behavior — pointed at the right directory.

### Repo Structure

```
dash-ai-langchain/
  ├── packages/
  │   ├── client/          ← React frontend (initially copied from dash-ai, will diverge)
  │   └── server/          ← Hono + TypeScript (API, routes, SQLite, queueWorker)
  │         ├── src/
  │         │   ├── db/
  │         │   │   └── schema.ts
  │         │   ├── routes/
  │         │   ├── services/
  │         │   │   ├── queueWorker.ts
  │         │   │   ├── planningRunner.ts   ← spawns deepagents CLI
  │         │   │   └── codingRunner.ts     ← spawns deepagents CLI
  │         │   └── index.ts
  │         └── package.json
  ├── pnpm-workspace.yaml
  ├── package.json
  └── ecosystem.config.js  ← PM2: client dev server + Hono server (2 processes only)
```

### How the Pieces Connect

```
React Frontend
     ↕  REST + WebSocket
Hono Server (TypeScript)
  - Task/Project/Persona CRUD
  - SQLite via Drizzle ORM
  - queueWorker (polls DB, dispatches sessions)
  - WebSocket broadcaster (live events to UI)
     ↕  child_process.spawn()
deepagents CLI (system tool, installed via uv)
  - deepagents --headless --prompt "..." --model "..." --cwd /repo/path
  - writes plan docs directly to /repo/path/.planning/<planPath>/
  - streams events to stdout
  - exits with code 0 (success) or non-zero (failure)
```

### queueWorker Subprocess Pattern

```typescript
// packages/server/src/services/planningRunner.ts
import { spawn } from 'child_process'

export function runPlanningSession(
  taskId: string,
  prompt: string,
  model: string,     // e.g. "anthropic/claude-opus-4-6", "openai/gpt-4o"
  repoPath: string,  // absolute path to project repo
  broadcast: (event: string) => void,
): Promise<void> {
  return new Promise((resolve, reject) => {
    const proc = spawn('deepagents', [
      '--headless',
      '--prompt', prompt,
      '--model', model,
      '--cwd', repoPath,
    ])

    proc.stdout.on('data', (chunk) => broadcast(chunk.toString()))
    proc.stderr.on('data', (chunk) => broadcast(chunk.toString()))

    proc.on('close', (code) => {
      if (code === 0) resolve()
      else reject(new Error(`deepagents exited with code ${code}`))
    })
  })
}
```

### Key Differences from Dash AI (OpenCode)

| Concern | Dash AI (OpenCode) | Dash AI Langchain |
|---|---|---|
| Agent executor | OpenCode SDK (`@opencode-ai/sdk`) | `deepagents-cli` (spawned as subprocess) |
| Python service | None | None (CLI is a system tool, not a service) |
| Model config | Persona → OpenCode model string | Persona → `provider/model-id` (LangChain format) |
| PM2 processes | 2 (client, server) | 2 (client, server) — same |
| Planning output | Skills write `.planning/` files | Agent writes `.planning/` files via `LocalFilesystemBackend` |
| Memory | Static skills knowledge | `~/.deepagents/<name>/memories/` persistent memory |
| Skills prereq | User must install skill stack manually | User runs `uv tool install 'deepagents-cli[anthropic]'` once |
| Headless/CI support | Via OpenCode SDK API | `--headless` flag built into CLI |

---

## DB Schema

Copy the Dash AI schema as a starting point (reference `packages/server/src/db/schema.ts`):

- **`tasks`** — `id`, `title`, `description`, `status` (9-state enum, see below), `projectId`, `planningPersonaId`, `codingPersonaId`, `planPath`, `planFeedback`, `createdAt`, `updatedAt`
- **`projects`** — `id`, `name`, `description`, `path`, `isActive`
- **`personas`** — `id`, `name`, `type` (`planner` | `coder` | `custom`), `model`, `systemPrompt`, `provider`
- **`taskEvents`** — `id`, `taskId`, `type`, `content`, `createdAt`

### Task Status Enum (9 states)

```
CREATED → IN_PLANNING → PLANNED → READY_TO_CODE → QUEUED → RUNNING → AWAITING_REVIEW → COMPLETED
                                                                                       → FAILED
```

### Persona Model Format

The `personas.model` field should follow LangChain's `provider/model-id` convention, passed directly to `deepagents --model`:

- `anthropic/claude-opus-4-6`
- `openai/gpt-4o`
- `ollama/llama3`

---

## Scaffold Steps

1. **Init the monorepo** — `pnpm` workspace with `packages/client` and `packages/server`

2. **Copy and adapt the frontend** — copy `packages/client` from `github.com/prillcode/dash-ai`; update API base URL config; remove any OpenCode-specific UI elements (skills check warnings, OpenCode connection status, etc.)

3. **Scaffold the Hono server** — copy `packages/server` from Dash AI as a base; strip out all `@opencode-ai/sdk` imports; replace `planningRunner.ts` and `codingRunner.ts` with child process wrappers that spawn `deepagents`

4. **Assemble the planning prompt** — the prompt passed to `deepagents --prompt` should be constructed from: task title + description + persona system prompt + instruction to write plan docs to `.planning/<planPath>/` with the standard `BRIEF.md`, `ROADMAP.md`, `PLAN.md` structure

5. **PM2 config** — `ecosystem.config.js` with 2 processes: client dev server and Hono server

6. **`.env.example`** — document required vars:
   ```
   SQLITE_DB_PATH=./data/dash-ai-langchain.db
   PORT=3001
   # Provider API keys (set whichever you use):
   ANTHROPIC_API_KEY=
   OPENAI_API_KEY=
   ```

7. **README** — document full setup:
   - Install `deepagents-cli`: `uv tool install 'deepagents-cli[anthropic]'` (or `[openai]` etc.)
   - `pnpm install`
   - `cp .env.example .env` and fill in keys
   - `pnpm db:migrate`
   - `pm2 start ecosystem.config.js` or `pnpm dev`

---

## Prerequisites & Dependencies

### User Setup (one-time)
```bash
# Install uv if not present
curl -LsSf https://astral.sh/uv/install.sh | sh

# Install deepagents-cli with your provider(s) of choice
uv tool install 'deepagents-cli[anthropic]'
# or: uv tool install 'deepagents-cli[openai]'
# or: uv tool install 'deepagents-cli[anthropic,openai]'
```

### Node/TypeScript (server)
- `hono`, `better-sqlite3`, `drizzle-orm`, `drizzle-kit`, `ws`, `zod`

### No Python package dependencies in the repo
The `deepagents-cli` is a system tool installed by the user — it does not live inside the repo as a `pyproject.toml` dependency.

---

## planPath Naming Convention

Maintain the same convention from Dash AI: `{id}-{slugified-title}`

Example: task id `101`, title "My New Feature" → `planPath` = `101-my-new-feature`

The agent writes plan docs to: `<project.path>/.planning/101-my-new-feature/`

---

## Out of Scope for Initial Build

- LangSmith tracing integration (useful later for debugging agent runs)
- Auth / multi-user support (same as Dash AI — single-user, self-hosted)
- Remote sandbox execution (Daytona, Modal, Runloop — CLI supports these but not needed yet)
- Shared npm package between dash-ai and dash-ai-langchain

---

## Notes for Claude

- Study `packages/server/src/services/queueWorker.ts` and `packages/server/src/opencode/` in Dash AI before writing the runner logic — the subprocess pattern here directly replaces the OpenCode SDK calls
- The `deepagents-cli` writes files via its own `LocalFilesystemBackend` — there's no need to write plan files from Node.js; the agent does it natively
- Match the Dash AI API surface where possible (same route shapes, same response formats) to minimize frontend changes
- The `--headless` flag is the key to non-interactive use; verify exact flag names against the installed CLI version with `deepagents --help`
- WebSocket event broadcasting in the Hono server should pipe `proc.stdout` chunks directly to connected clients on the Monitor page

---

*Reference project:* `github.com/prillcode/dash-ai`
