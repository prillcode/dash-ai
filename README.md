<p align="center">
  <img src="packages/client/public/assets/agent-dash-task-queue.png" alt="Dash AI" />
</p>

A self-hosted, planning-first AI kanban board for managing coding tasks across local repos. Submit a task, let an AI planner generate a spec, review and iterate on it, then approve it for coding — all from the dashboard or CLI.

## How it works

1. **Register a project** — point the dashboard at a local repo
2. **Create a task** — describe the work, assign a Planning Persona + Coding Persona
3. **Start Planning** — the AI generates BRIEF.md + ROADMAP.md + phase plans in `.planning/`
4. **Review the plan** — read BRIEF.md and ROADMAP.md directly in the dashboard; iterate with feedback if needed
5. **Mark Ready to Code** — the coding queue picks it up automatically
6. **Review the diff** — once the coding session completes, review the diff and approve or reject

## Prerequisites

- **Node.js** v22+ (nvm recommended)
- **pnpm** — `npm install -g pnpm`
- **Pi SDK skills** installed at `~/.agents/skills/`:
  - `start-work-begin`
  - `start-work-plan`
  - `start-work-run`

## Provider Configuration (API Keys)

Dash AI uses the **Pi SDK** for AI provider management. API keys are loaded from:

### Option 1: Pi CLI Auth Storage (Recommended)
```bash
# Stored in ~/.pi/agent/auth.json
pi login                    # For OAuth providers
pi config set-api-key       # For API key providers
```

### Option 2: Environment Variables
```bash
# Web/server development: add to repo-root .env or your shell profile
export OPENAI_API_KEY=sk-...
export ANTHROPIC_API_KEY=sk-ant-...
export DEEPSEEK_API_KEY=...
# etc.
```

For the Electron app, environment variables can also be loaded from `~/.dash-ai/.env`.

**Only providers with configured API keys appear in the Persona dropdown.** The provider list is filtered to show only authenticated providers from Pi SDK's `AuthStorage`.

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

Edit the repo-root `.env`:

```bash
# Required: secret token for API auth
# Generate with: openssl rand -hex 32
API_TOKEN=your-secret-token-here

# Required for the Vite client; must match API_TOKEN
VITE_API_TOKEN=your-secret-token-here

# Optional
PORT=3000
MAX_CONCURRENT_SESSIONS=3
```

Notes:
- The standalone server loads environment variables from the repo-root `.env`.
- `packages/server/.env` is not used by the normal web development flow.
- Electron loads its own environment from `~/.dash-ai/.env`.

### 3. Configure your AI provider(s)

**Via Pi CLI:**
```bash
# OAuth-capable providers
pi login

# API-key providers
pi config set-api-key
```

**Or via environment variables:** add provider keys to the repo-root `.env` (web/server) or `~/.dash-ai/.env` (Electron).

Keys stored in `~/.pi/agent/auth.json` are also automatically detected by Dash AI.

### 4. Apply migrations

```bash
pnpm db:migrate
```

Database is created at `~/.dash-ai/dashboard.db` (SQLite, local file).

**Important:** never run `pnpm db:generate` — see `AGENTS.md` for migration rules.

### 5. Start development

**Option A: Web app (recommended for normal development)**
```bash
pnpm dev
```

This runs the standalone API server and the Vite React client in parallel from one terminal.

- Client: http://localhost:5173
- Server: http://localhost:3000

Equivalent manual commands if needed:
```bash
# Terminal 1: API Server
pnpm --filter server dev

# Terminal 2: React Client
pnpm --filter client dev
```

**Option B: Electron desktop app**
```bash
pnpm dev:electron
```

Electron uses the same React UI from `packages/client`, but runs it inside a desktop shell and starts an embedded API server automatically. It loads provider/API-key environment variables from `~/.dash-ai/.env`.

**Option C: CLI**
```bash
cd packages/cli
node dist/index.js --help
```

## Package roles

- `packages/client` — shared React frontend UI
- `packages/server` — standalone Hono API server, database access, queue worker, and Pi SDK integration
- `packages/electron` — desktop wrapper that launches an embedded server and serves the built client UI locally

In other words, `packages/client` is not a separate product from Electron — Electron reuses that same frontend inside a desktop app.

## Personas

Personas define how the AI behaves. There are four types:

| Type | Purpose | Default model | Bash tool |
|------|---------|---------------|-----------|
| `planner` | Generates BRIEF + PLAN docs | claude-opus-4-5 | No |
| `coder` | Executes PLAN.md tasks | claude-sonnet-4-5 | Yes |
| `reviewer` | Reviews diffs | claude-sonnet-4-5 | No |
| `custom` | Any other use | configurable | configurable |

**Provider and model selection** is filtered to only show providers with configured API keys. The dropdown dynamically updates based on your `~/.pi/agent/auth.json` or environment variables.

## Task State Machine

```
DRAFT → IN_PLANNING → PLANNED → READY_TO_CODE → QUEUED → RUNNING → AWAITING_REVIEW → APPROVED → COMPLETE
                                                                                      ↘ REJECTED
                                                         (on error at any stage) → FAILED
```

Manual transitions available from the dashboard:
- **DRAFT → IN_PLANNING**: "Start Planning" button
- **PLANNED → IN_PLANNING**: "Iterate Plan" (provide feedback, re-trigger AI)
- **PLANNED → READY_TO_CODE**: "Mark Ready to Code"
- **AWAITING_REVIEW → APPROVED/REJECTED**: review buttons on task detail

## API Reference

All endpoints require `Authorization: Bearer <API_TOKEN>` except `GET /api/models`.

### Auth & Models

| Method | Endpoint | Description |
|--------|----------|-------------|
| GET | `/api/auth/status` | Overall auth status (all providers) |
| GET | `/api/auth/provider?provider=anthropic` | Check specific provider auth |
| POST | `/api/auth/refresh` | Trigger auth refresh/login |
| GET | `/api/models` | Available providers + models (filtered to configured) |

### Projects

| Method | Endpoint | Description |
|--------|----------|-------------|
| GET | `/api/projects` | List projects (`?activeOnly=true`) |
| POST | `/api/projects` | Create project |
| GET | `/api/projects/:id` | Get project |
| PATCH | `/api/projects/:id` | Update project |
| DELETE | `/api/projects/:id` | Delete project |

### Personas

| Method | Endpoint | Description |
|--------|----------|-------------|
| GET | `/api/personas` | List personas |
| POST | `/api/personas` | Create persona |
| GET | `/api/personas/:id` | Get persona |
| PUT | `/api/personas/:id` | Update persona |
| PATCH | `/api/personas/:id/toggle` | Toggle active |
| DELETE | `/api/personas/:id` | Soft delete |

### Tasks

| Method | Endpoint | Description |
|--------|----------|-------------|
| GET | `/api/tasks` | List tasks (`?status=`, `?personaId=`) |
| POST | `/api/tasks` | Create task |
| GET | `/api/tasks/:id` | Get task |
| PATCH | `/api/tasks/:id` | Update task fields |
| PATCH | `/api/tasks/:id/status` | Update status |
| POST | `/api/tasks/:id/start-planning` | Trigger planning |
| POST | `/api/tasks/:id/iterate-plan` | Re-plan with feedback |
| POST | `/api/tasks/:id/review` | Run reviewer persona |
| GET | `/api/tasks/:id/plan-doc` | Read plan doc (`?file=BRIEF.md`) |
| GET | `/api/tasks/:id/diff` | Get diff file |

### Events

| Method | Endpoint | Description |
|--------|----------|-------------|
| GET | `/api/tasks/:taskId/events` | List task events |
| WS | `/ws/tasks/:taskId/stream` | Real-time event stream |

## CLI Usage

```bash
# List tasks
dash-ai tasks list

# Create and auto-plan a task
dash-ai tasks create \
  --project my-app \
  --title "Add rate limiting" \
  --description "Add middleware with 100 req/min per IP" \
  --planner "Planner" \
  --coder "Coder" \
  --auto-plan

# Watch progress
dash-ai tasks watch <task-id>

# View plan
dash-ai tasks plan-docs <task-id> --file BRIEF.md

# Approve and code
dash-ai tasks approve-plan <task-id>
dash-ai tasks wait <task-id> --status AWAITING_REVIEW
```

See `packages/cli/AGENT-USAGE.md` for complete CLI reference.

## Deployment

### Production Build

```bash
pnpm build
```

### PM2

```bash
pnpm build
pm2 start packages/server/dist/index.js --name "dash-ai"
pm2 save
pm2 startup  # auto-start on system boot
```

### Electron Packaging

```bash
cd packages/electron
pnpm run dist:linux    # or dist:mac, dist:win
```

## Tech Stack

| Layer | Technology |
|-------|-----------|
| Runtime | Node.js v22 |
| Package manager | pnpm |
| Backend | Hono + `@hono/node-server` |
| Database | SQLite (`better-sqlite3`) + Drizzle ORM |
| Frontend | React 18 + TypeScript + Vite |
| Styling | Tailwind CSS |
| Data fetching | TanStack Query v5 |
| Forms | React Hook Form + Zod |
| Routing | React Router v6 |
| AI execution | Pi SDK (`@mariozechner/pi-coding-agent`) |
| Desktop | Electron |

## License

MIT
