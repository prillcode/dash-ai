<p align="center">
  <img src="public/assets/dash-ai-logo.png" alt="Dash AI" width="320" />
</p>

A self-hosted, planning-first AI kanban board for managing coding tasks across local repos. Submit a task, let an AI planner generate a spec, review and iterate on it, then approve it for coding — all from the dashboard.

## How it works

1. **Register a project** — point the dashboard at a local repo
2. **Create a task** — describe the work, assign a Planning Persona + Coding Persona
3. **Start Planning** — the AI runs `start-work` + `create-plans` in your repo, producing BRIEF.md + PLAN.md files in `.planning/`
4. **Review the plan** — read BRIEF.md and ROADMAP.md directly in the dashboard; iterate with feedback if needed
5. **Mark Ready to Code** — the coding queue picks it up automatically
6. **Review the diff** — once the coding session completes, review the diff and approve or reject

## Prerequisites

- **Node.js** v22+ (nvm recommended)
- **pnpm** — `npm install -g pnpm`
- **OpenCode** installed globally — for AI agent execution
- **Planning skill stack** (required for Planning mode):
  ```bash
  npx @prillcode/start-work
  ```
  Installs `start-work` and `create-plans` skills to `~/.agents/skills/`

## Quick Start

### 1. Clone and install

```bash
git clone <repository-url>
cd dash-ai
pnpm install
```

### 2. Configure environment

```bash
cp .env.example .env
```

Edit `.env`:

```bash
# Required: secret token for API auth
# Generate with: openssl rand -hex 32
API_TOKEN=your-secret-token-here

# Optional
PORT=3000
MAX_CONCURRENT_SESSIONS=3
```

### 3. Configure your AI provider

On first run, `~/.dash-ai/models.json` is auto-created with defaults. Edit it to configure available models. API keys are managed via OpenCode `/connect` command or environment variables.

```json
{
  "provider": "anthropic",
  "apiKey": "sk-ant-...",
  "plannerModel": "claude-opus-4-5",
  "coderModel": "claude-sonnet-4-5"
}
```

### 4. Apply migrations

```bash
pnpm db:migrate
```

Database is created at `~/.dash-ai/dashboard.db` (SQLite, local file).

**Upgrading from v0.5.x?** If you have an existing `~/.ai-dashboard/` directory, move it:
```bash
mv ~/.ai-dashboard ~/.dash-ai
```

**Important:** never run `pnpm db:generate` — see `AGENTS.md` for migration rules.

### 5. Start development

```bash
pnpm dev
```

- Client: http://localhost:5173
- Server: http://localhost:3000

## Planning Workflow

The planning phase runs the `start-work` + `create-plans` skill stack inside your project repo. The AI generates:

```
your-repo/.planning/
└── <task-slug>/
    ├── BRIEF.md       ← project vision
    ├── ROADMAP.md     ← phased plan
    └── phases/
        └── 01-*/
            └── 01-01-PLAN.md   ← executable task prompt
```

You can read BRIEF.md and ROADMAP.md directly in the dashboard on the task detail page. If the plan needs work, click **Iterate Plan**, provide feedback, and the AI re-runs planning with your notes.

When you're happy with the plan, click **Mark Ready to Code** — the queue worker picks it up and runs the coding session.

## Personas

Personas define how the AI behaves. There are four types:

| Type | Purpose | Default model | Bash tool |
|------|---------|---------------|-----------|
| `planner` | Generates BRIEF + PLAN docs | claude-opus-4-5 | No |
| `coder` | Executes PLAN.md tasks | claude-sonnet-4-5 | Yes |
| `reviewer` | Reviews diffs | claude-sonnet-4-5 | No |
| `custom` | Any other use | configurable | configurable |

Provider and model are configurable per persona — they are selected from `~/.dash-ai/models.json` at session start.

## Projects

Projects register local repos by name and filesystem path. Paths support `~` (expanded at runtime). The path is validated against the filesystem when you save.

Once a project is registered, it appears in the task creation form as a dropdown — no more error-prone free-text repo paths.

## Task State Machine

```
DRAFT → IN_PLANNING → PLANNED → READY_TO_CODE → QUEUED → RUNNING → AWAITING_REVIEW → APPROVED → COMPLETE
                                                                                      ↘ REJECTED
                                                         (on error at any stage) → FAILED
```

Manual transitions available from the dashboard:
- **DRAFT → IN_PLANNING**: "Start Planning" button (requires Planning Persona)
- **PLANNED → IN_PLANNING**: "Iterate Plan" (provide feedback, re-trigger AI)
- **PLANNED → READY_TO_CODE**: "Mark Ready to Code"
- **AWAITING_REVIEW → APPROVED/REJECTED**: review buttons on task detail

## API Reference

All endpoints require `Authorization: Bearer <API_TOKEN>` except `GET /api/models`.

### Projects

| Method | Endpoint | Description |
|--------|----------|-------------|
| GET | `/api/projects` | List projects (`?activeOnly=true`) |
| POST | `/api/projects` | Create project |
| GET | `/api/projects/:id` | Get project |
| PATCH | `/api/projects/:id` | Update project |
| DELETE | `/api/projects/:id` | Delete project |
| GET | `/api/projects/validate-path` | Validate path (`?path=~/my-repo`) |

### Personas

| Method | Endpoint | Description |
|--------|----------|-------------|
| GET | `/api/personas` | List personas |
| POST | `/api/personas` | Create persona |
| GET | `/api/personas/:id` | Get persona |
| PUT | `/api/personas/:id` | Update persona |
| PATCH | `/api/personas/:id/toggle` | Toggle active |
| DELETE | `/api/personas/:id` | Soft delete |
| GET | `/api/models` | Available providers + models (public) |

### Tasks

| Method | Endpoint | Description |
|--------|----------|-------------|
| GET | `/api/tasks` | List tasks (`?status=`, `?personaId=`) |
| POST | `/api/tasks` | Create task |
| GET | `/api/tasks/:id` | Get task |
| PATCH | `/api/tasks/:id/status` | Update status manually |
| POST | `/api/tasks/:id/start-planning` | Trigger planning (DRAFT → IN_PLANNING) |
| POST | `/api/tasks/:id/iterate-plan` | Re-plan with feedback (PLANNED → IN_PLANNING) |
| GET | `/api/tasks/:id/plan-doc` | Read plan doc (`?file=BRIEF.md`) |
| GET | `/api/tasks/:id/diff` | Get diff file |

### Events

| Method | Endpoint | Description |
|--------|----------|-------------|
| GET | `/api/tasks/:taskId/events` | List task events |
| WS | `/ws/tasks/:taskId/stream` | Real-time event stream |

## Deployment (PM2)

```bash
pnpm build
pm2 start packages/server/dist/index.js --name "dash-ai"
pm2 save
pm2 startup  # auto-start on system boot
```

To update:

```bash
git pull origin main
pnpm install
pnpm db:migrate
pnpm build
pm2 restart dash-ai
```

## Tech Stack

| Layer | Technology |
|-------|-----------|
| Runtime | Node.js v22 |
| Package manager | pnpm |
| Backend | Hono + `@hono/node-server` |
| Database | SQLite (`better-sqlite3`) + Drizzle ORM |
| Frontend | React 18 + TypeScript + Vite |
| Styling | Tailwind CSS v4 |
| Data fetching | TanStack Query v5 |
| Forms | React Hook Form + Zod |
| Routing | React Router v6 |
| AI execution | OpenCode SDK (`@opencode-ai/sdk`) |

## License

MIT
