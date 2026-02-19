# ai-dashboard — Claude Code Handoff

## What You Are Building

A self-hosted AI Agent Dashboard called **ai-dashboard**. It is a monorepo with a Hono backend and React frontend that allows the user to define AI agent personas, submit coding tasks to a queue, and monitor task execution in real time via an OpenCode SDK integration.

This document is the single source of truth for scaffolding the project. Two reference documents exist alongside this one:

- `.planning/01-data-model-option-b.md` — full database schema (Drizzle + Turso/libSQL)
- `.planning/01-component-structure-option-b.md` — full frontend component tree and backend route/service layout

Read both documents before writing any code.

---

## Stack

| Layer | Technology |
|-------|-----------|
| Runtime | Node.js (LTS) |
| Package manager | pnpm |
| Backend framework | Hono (`hono` + `@hono/node-server`) |
| Database | Turso Cloud via `@libsql/client` + `drizzle-orm` |
| ORM / migrations | Drizzle Kit |
| Frontend | React 18 + TypeScript + Vite |
| Styling | Tailwind CSS v3 |
| Data fetching | TanStack Query v5 |
| Forms | React Hook Form + Zod |
| Routing | React Router v6 |
| AI agent execution | `@opencode-ai/sdk` |
| ID generation | `nanoid` |
| Process manager | PM2 (not scaffolded, just referenced in README) |

---

## Monorepo Structure

Scaffold the project as a pnpm workspace monorepo:

```
ai-dashboard/
├── pnpm-workspace.yaml
├── package.json                  ← root (scripts only, no dependencies)
├── .env.example
├── README.md
├── packages/
│   ├── server/                   ← Hono backend
│   │   ├── package.json
│   │   ├── tsconfig.json
│   │   ├── drizzle.config.ts
│   │   └── src/
│   │       ├── index.ts
│   │       ├── db/
│   │       │   ├── client.ts
│   │       │   ├── schema.ts
│   │       │   └── migrations/   ← drizzle-kit output (empty to start)
│   │       ├── routes/
│   │       │   ├── personas.ts
│   │       │   ├── tasks.ts
│   │       │   └── events.ts
│   │       ├── services/
│   │       │   ├── personaService.ts
│   │       │   ├── taskService.ts
│   │       │   ├── eventService.ts
│   │       │   └── queueWorker.ts
│   │       ├── opencode/
│   │       │   └── sessionRunner.ts
│   │       ├── ws/
│   │       │   └── taskStream.ts
│   │       ├── middleware/
│   │       │   ├── auth.ts
│   │       │   └── logger.ts
│   │       └── utils/
│   │           ├── id.ts
│   │           └── time.ts
│   └── client/                   ← React frontend
│       ├── package.json
│       ├── tsconfig.json
│       ├── vite.config.ts
│       ├── tailwind.config.ts
│       ├── postcss.config.js
│       ├── index.html
│       └── src/
│           ├── main.tsx
│           ├── App.tsx
│           ├── api/
│           │   ├── client.ts
│           │   ├── personas.ts
│           │   ├── tasks.ts
│           │   └── events.ts
│           ├── components/
│           │   ├── ui/
│           │   ├── personas/
│           │   ├── tasks/
│           │   ├── timeline/
│           │   └── diff/
│           ├── pages/
│           │   ├── TaskQueuePage.tsx
│           │   ├── TaskDetailPage.tsx
│           │   ├── TaskCreatePage.tsx
│           │   ├── PersonaListPage.tsx
│           │   └── PersonaFormPage.tsx
│           ├── layouts/
│           │   ├── AppLayout.tsx
│           │   └── Sidebar.tsx
│           ├── types/
│           │   ├── persona.ts
│           │   └── task.ts
│           └── utils/
│               ├── formatters.ts
│               └── constants.ts
```

---

## pnpm Workspace Config

**`pnpm-workspace.yaml`:**
```yaml
packages:
  - "packages/*"
```

**Root `package.json`:**
```json
{
  "name": "ai-dashboard",
  "private": true,
  "scripts": {
    "dev": "pnpm --parallel -r dev",
    "build": "pnpm -r build",
    "db:generate": "pnpm --filter server db:generate",
    "db:migrate": "pnpm --filter server db:migrate"
  }
}
```

---

## Environment Variables

**`.env.example`** (copy to `.env` and fill in):
```bash
# Turso
TURSO_DATABASE_URL=libsql://your-db.turso.io
TURSO_AUTH_TOKEN=your-token-here

# Optional: embedded replica for faster local reads
# TURSO_LOCAL_DB_PATH=/home/user/.ai-dashboard/local.db

# OpenCode working directory
OPENCODE_WORKING_DIR=/home/user/agent-workspaces

# Local storage for diffs and session logs
DIFF_STORAGE_DIR=/home/user/.ai-dashboard/diffs
LOG_STORAGE_DIR=/home/user/.ai-dashboard/sessions

# Auth — all API requests require: Authorization: Bearer <API_TOKEN>
API_TOKEN=change-me

# Queue worker
MAX_CONCURRENT_SESSIONS=3

# Server
PORT=3000
NODE_ENV=development
```

---

## Server Package

### `packages/server/package.json`
```json
{
  "name": "@ai-dashboard/server",
  "version": "0.1.0",
  "private": true,
  "type": "module",
  "scripts": {
    "dev": "tsx watch src/index.ts",
    "build": "tsc",
    "start": "node dist/index.js",
    "db:generate": "drizzle-kit generate",
    "db:migrate": "drizzle-kit migrate"
  },
  "dependencies": {
    "@hono/node-server": "^1.0.0",
    "@libsql/client": "^0.14.0",
    "@opencode-ai/sdk": "latest",
    "drizzle-orm": "^0.40.0",
    "hono": "^4.0.0",
    "nanoid": "^5.0.0",
    "zod": "^3.0.0"
  },
  "devDependencies": {
    "@types/node": "^20.0.0",
    "drizzle-kit": "^0.30.0",
    "tsx": "^4.0.0",
    "typescript": "^5.0.0"
  }
}
```

### Database Schema (`src/db/schema.ts`)

Implement exactly as defined in `data-model-option-b.md`. Use Drizzle's `sqliteTable`. Three tables: `personas`, `tasks`, `task_events`. Include all indexes.

### Drizzle Config (`drizzle.config.ts`)
```ts
import { defineConfig } from "drizzle-kit"

export default defineConfig({
  schema: "./src/db/schema.ts",
  out: "./src/db/migrations",
  dialect: "turso",
  dbCredentials: {
    url: process.env.TURSO_DATABASE_URL!,
    authToken: process.env.TURSO_AUTH_TOKEN,
  },
})
```

### DB Client (`src/db/client.ts`)
```ts
import { createClient } from "@libsql/client"
import { drizzle } from "drizzle-orm/libsql"
import * as schema from "./schema"

const client = createClient({
  url: process.env.TURSO_LOCAL_DB_PATH
    ? `file:${process.env.TURSO_LOCAL_DB_PATH}`
    : process.env.TURSO_DATABASE_URL!,
  authToken: process.env.TURSO_AUTH_TOKEN,
  ...(process.env.TURSO_LOCAL_DB_PATH && {
    syncUrl: process.env.TURSO_DATABASE_URL,
  }),
})

export const db = drizzle(client, { schema })
```

### Hono Entry (`src/index.ts`)

- Mount all route files under `/api`
- Apply auth middleware to all `/api/*` routes
- Serve the React build (`packages/client/dist`) as static files for all other routes
- Call `startQueueWorker()` on startup
- Use `@hono/node-server` to serve
- Log startup message with port

### Auth Middleware (`src/middleware/auth.ts`)

Simple Bearer token check against `process.env.API_TOKEN`. Return `401` if missing or invalid. Skip auth for health check route `GET /api/health`.

### Routes

Implement all routes as defined in `component-structure-option-b.md`. Each route file uses Hono's `Hono` router and delegates to the corresponding service. Use Zod for request body validation — return `400` with validation errors on bad input.

**`routes/personas.ts`** — full CRUD: list, create, get, update, toggle active, soft delete  
**`routes/tasks.ts`** — list (with filters), create, get, update status, serve diff file  
**`routes/events.ts`** — list events for a task

### Services

**`personaService.ts`** — Drizzle queries for personas. Parse JSON array fields (allowedTools, contextFiles, tags) on read, stringify on write.

**`taskService.ts`** — Drizzle queries for tasks. Include an atomic `claimNextPendingTask()` method that updates status from `PENDING` → `QUEUED` in a single query to prevent double-processing by the worker.

**`eventService.ts`** — Append events to `task_events`, parse/stringify JSON payload. Also push appended events to WebSocket subscribers (import from `taskStream.ts`).

**`queueWorker.ts`** — Polling loop as described in `component-structure-option-b.md`. Use a simple semaphore (counter + max from env) to cap concurrent sessions. On startup, reset any tasks stuck in `QUEUED` or `RUNNING` status back to `PENDING` (handles VM restart recovery).

### OpenCode Session Runner (`src/opencode/sessionRunner.ts`)

```ts
import { createOpencode } from "@opencode-ai/sdk"

// Full implementation:
// 1. createOpencode({ config: { model: persona.model } })
// 2. session.create({ body: { title: task.title } })
// 3. session.prompt() with noReply: true to inject persona.systemPrompt
// 4. Inject each persona.contextFiles entry as noReply context
// 5. Subscribe to event.subscribe() and pipe events to eventService
// 6. session.prompt() with the actual task.description
// 7. file.status() to get changed files
// 8. Write diff to DIFF_STORAGE_DIR/<taskId>/changes.diff
// 9. Write session log to LOG_STORAGE_DIR/<taskId>/session.log
// 10. server.close() in finally block
// Emit typed events: STATUS_CHANGE, TOOL_CALL, AGENT_OUTPUT, ERROR
```

### WebSocket (`src/ws/taskStream.ts`)

Maintain a `Map<taskId, Set<WSContext>>` registry. Export `subscribe(taskId, ws)`, `unsubscribe(taskId, ws)`, and `broadcast(taskId, event)`. Mount the WebSocket route at `/ws/tasks/:taskId/stream` using Hono's `upgradeWebSocket`.

### Utils

**`src/utils/id.ts`** — export `generateId()` wrapping `nanoid()`  
**`src/utils/time.ts`** — export `now()` returning `new Date().toISOString()`

---

## Client Package

### `packages/client/package.json`
```json
{
  "name": "@ai-dashboard/client",
  "version": "0.1.0",
  "private": true,
  "scripts": {
    "dev": "vite",
    "build": "tsc && vite build",
    "preview": "vite preview"
  },
  "dependencies": {
    "@tanstack/react-query": "^5.0.0",
    "react": "^18.0.0",
    "react-dom": "^18.0.0",
    "react-hook-form": "^7.0.0",
    "react-router-dom": "^6.0.0",
    "zod": "^3.0.0",
    "react-diff-view": "^3.0.0",
    "unidiff": "^1.0.0"
  },
  "devDependencies": {
    "@types/react": "^18.0.0",
    "@types/react-dom": "^18.0.0",
    "@vitejs/plugin-react": "^4.0.0",
    "autoprefixer": "^10.0.0",
    "postcss": "^8.0.0",
    "tailwindcss": "^3.0.0",
    "typescript": "^5.0.0",
    "vite": "^5.0.0"
  }
}
```

### Vite Config (`vite.config.ts`)

```ts
import { defineConfig } from "vite"
import react from "@vitejs/plugin-react"

export default defineConfig({
  plugins: [react()],
  server: {
    proxy: {
      "/api": "http://localhost:3000",
      "/ws": { target: "ws://localhost:3000", ws: true },
    },
  },
  build: {
    outDir: "dist",
  },
})
```

The proxy means in dev mode the React dev server proxies API and WebSocket calls to the Hono server — no CORS issues. In production, Hono serves the built React files directly.

### Types (`src/types/`)

Define TypeScript interfaces that mirror the Drizzle schema exactly. JSON array fields should be typed as `string[]` (deserialized). Include the `TaskStatus` const enum.

### API Client (`src/api/client.ts`)

Base fetch wrapper that:
- Uses relative URLs (`/api/...`) so it works in both dev (proxied) and prod (same origin)
- Attaches `Authorization: Bearer <token>` header — read token from `import.meta.env.VITE_API_TOKEN`
- Throws on non-2xx responses with a typed error

Add `VITE_API_TOKEN` to `.env.example`.

### TanStack Query Hooks

Implement all hooks as defined in `component-structure-option-b.md`. Use appropriate `staleTime` and `refetchInterval` per resource type. The `useTaskEventStream` hook should load initial events via REST query then open a WebSocket for live events while the task is running.

### Pages and Components

Implement all pages and components as defined in `component-structure-option-b.md`. 

Key implementation notes:

- `TaskStatusBadge` — color-coded pill, `RUNNING` status should have a subtle pulse animation (Tailwind `animate-pulse`)
- `TaskTimelinePanel` — uses `useTaskEventStream` hook, auto-scrolls to bottom on new events
- `DiffReviewPanel` — only render when `task.status === 'AWAITING_REVIEW'`. Fetch diff via `GET /api/tasks/:id/diff`. Use `react-diff-view` to render. Include approve/reject buttons that call `PATCH /api/tasks/:id/status`
- `PersonaSelector` — reusable dropdown used in both `TaskCreatePage` and `TaskFilterBar`
- `AppLayout` — sidebar with nav links to `/tasks` and `/personas`, simple top bar with app name
- All forms use React Hook Form + Zod validation, show inline field errors

### UI Components (`src/components/ui/`)

Scaffold these minimal primitives (implement with Tailwind, no external component library needed):

- `Button` — variants: `default`, `ghost`, `destructive`, `success`
- `Badge` — color prop
- `FormField` — label + input/textarea + error message
- `Modal` — simple overlay dialog
- `Spinner` — loading indicator
- `EmptyState` — icon + heading + subtext

---

## README.md

Write a clear README that covers:

1. Prerequisites (Node.js LTS, pnpm, Turso CLI, OpenCode installed globally)
2. Clone and install: `pnpm install`
3. Copy `.env.example` to `.env` and fill in Turso credentials
4. Run migrations: `pnpm db:generate && pnpm db:migrate`
5. Dev mode: `pnpm dev` (starts both server and client in parallel)
6. Production build: `pnpm build`
7. PM2 deployment:
```bash
pnpm add -g pm2
pm2 start packages/server/dist/index.js --name "ai-dashboard"
pm2 save && pm2 startup
```
8. Cloudflare Tunnel setup (reference `component-structure-option-b.md`)
9. Brief description of the three core concepts: Personas, Task Queue, and how OpenCode fits in

---

## Scaffolding Order

Follow this order to avoid import/dependency errors:

1. Root monorepo files (`pnpm-workspace.yaml`, root `package.json`, `.env.example`)
2. `packages/server` — `package.json`, `tsconfig.json`
3. `packages/server/src/db/schema.ts` and `client.ts`
4. `packages/server/src/utils/` (id, time)
5. `packages/server/src/services/` (persona, task, event — no queueWorker yet)
6. `packages/server/src/middleware/`
7. `packages/server/src/routes/`
8. `packages/server/src/ws/taskStream.ts`
9. `packages/server/src/opencode/sessionRunner.ts`
10. `packages/server/src/services/queueWorker.ts`
11. `packages/server/src/index.ts`
12. `packages/client` — `package.json`, `tsconfig.json`, `vite.config.ts`, Tailwind config
13. `packages/client/src/types/`
14. `packages/client/src/api/`
15. `packages/client/src/components/ui/`
16. `packages/client/src/components/` (domain components)
17. `packages/client/src/layouts/`
18. `packages/client/src/pages/`
19. `packages/client/src/App.tsx` and `main.tsx`
20. Root `README.md`
21. Run `pnpm install` and verify no missing dependency errors
22. Run `pnpm db:generate` to generate initial migration
23. Fix any TypeScript errors (`tsc --noEmit` in both packages)

---

## Important Notes for Claude Code

- Use `pnpm` for all package operations, never `npm` or `yarn`
- All server code uses ESM (`"type": "module"` in package.json)
- JSON array fields in the DB (`allowedTools`, `contextFiles`, `tags`, `targetFiles`) are stored as JSON strings — always serialize on write and parse on read in the service layer, never in routes or components
- The `claimNextPendingTask()` in `taskService` must be atomic — use a single `UPDATE ... WHERE status = 'PENDING' RETURNING` or equivalent to prevent race conditions if multiple workers ever run
- The queue worker must reset stuck tasks (`QUEUED` or `RUNNING`) back to `PENDING` on startup to handle unclean shutdowns
- `sessionRunner.ts` must always call `server.close()` in a `finally` block — leaked OpenCode server processes will exhaust ports
- Do not use `localStorage` or `sessionStorage` anywhere in the frontend
- The `API_TOKEN` env var is server-side only. The client uses `VITE_API_TOKEN` (Vite exposes env vars prefixed with `VITE_` to the browser build)
- Tailwind should use only core utility classes — no custom plugins needed for Phase 1
