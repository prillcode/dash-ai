# AI Dashboard — Developer Guide

## Project Overview

A self-hosted AI Agent Dashboard with a Hono backend and React frontend. Users define AI agent personas, submit coding tasks to a queue, and monitor execution in real-time via OpenCode SDK integration.

### Tech Stack

| Layer | Technology |
|-------|------------|
| Runtime | Node.js (LTS) |
| Package Manager | pnpm |
| Backend | Hono + `@hono/node-server` |
| Database | SQLite (local, `better-sqlite3`) + Drizzle ORM |
| Frontend | React 18 + TypeScript + Vite |
| Styling | Tailwind CSS v3 |
| Data Fetching | TanStack Query v5 |
| Forms | React Hook Form + Zod |
| Routing | React Router v6 |
| AI Execution | `@opencode-ai/sdk` |

### Project Structure

```
ai-dashboard/
├── packages/
│   ├── server/           # Hono backend
│   │   └── src/
│   │       ├── db/          # Database schema + client
│   │       ├── routes/      # API endpoints
│   │       ├── services/    # Business logic
│   │       ├── middleware/  # Auth, logging
│   │       ├── ws/          # WebSocket handlers
│   │       └── opencode/    # OpenCode SDK integration
│   └── client/          # React frontend
│       └── src/
│           ├── api/         # TanStack Query hooks
│           ├── components/  # React components
│           ├── pages/       # Route pages
│           ├── layouts/     # Layout components
│           └── types/       # TypeScript types
```

## Coding Conventions

### Path Aliases

Use `@/*` instead of relative paths:

```typescript
// Good
import { Button } from "@/components/ui"
import { useTasks } from "@/api/tasks"

// Avoid
import { Button } from "../../components/ui"
```

Configured in both `tsconfig.json` files and `vite.config.ts`.

### Database

- Use Drizzle ORM for all database operations
- Schema defined in `packages/server/src/db/schema.ts`
- DB file lives at `~/.ai-dashboard/dashboard.db` (auto-created on first run)

#### Migration rules — CRITICAL

**Never wipe the DB to apply schema changes.** Always use additive migrations:

1. Edit `schema.ts` with the new column/table
2. **Do NOT run `pnpm db:generate`** — it prompts interactively in non-TTY environments and cannot be answered via stdin
3. Instead, manually create the next numbered migration file, e.g. `packages/server/src/db/migrations/0002_my_change.sql`:
   - For new columns: `ALTER TABLE \`table\` ADD \`column\` type DEFAULT value;`
   - For new tables: full `CREATE TABLE` statement
4. Register it in `packages/server/src/db/migrations/meta/_journal.json` (increment `idx`, new `tag`)
5. Update `packages/server/src/db/migrations/meta/0000_snapshot.json` to reflect the cumulative schema state
6. Run `pnpm db:migrate` — applies only the new migration, existing data is preserved

**Never do `rm ~/.ai-dashboard/dashboard.db`** unless explicitly told to reset all data.

### Environment Variables

- Server uses `process.env` (loaded via dotenv in `src/env.ts`)
- Client uses `import.meta.env.VITE_*` (Vite exposes these)
- Never use `.env` in client code — only `.env.example`

### API Patterns

- Backend routes return proper HTTP status codes (200, 201, 400, 404, 401)
- Use Zod for request validation
- Service layer handles DB operations, routes only handle HTTP

### React Components

- Use TanStack Query for data fetching with appropriate `staleTime` and `refetchInterval`
- Use React Hook Form + Zod for forms
- Tailwind for styling — prefer utility classes over custom CSS

### Git Conventions

- Run `pnpm build` before committing to catch TypeScript errors
- Don't commit `.env` files — use `.env.example` as template

## Running the Project

```bash
# Install dependencies
pnpm install

# Apply migrations (see migration rules above — do NOT use db:generate)
pnpm db:migrate

# Development
pnpm dev

# Production build
pnpm build
```

## Adding New Features

### New API Endpoint

1. Add route in `packages/server/src/routes/`
2. Add service function in `packages/server/src/services/`
3. Add TanStack Query hook in `packages/client/src/api/`
4. Add React component in `packages/client/src/components/`
5. Add page route in `packages/client/src/App.tsx`

### New Database Table

1. Add schema in `packages/server/src/db/schema.ts`
2. Run `pnpm db:generate`
3. Run `pnpm db:migrate`
4. Create service functions for CRUD operations

## Notes

- The OpenCode session runner (`packages/server/src/opencode/sessionRunner.ts`) is a placeholder — implement actual SDK integration based on `@opencode-ai/sdk` API
- WebSocket is used for real-time task event streaming
- Auth is via Bearer token in `Authorization` header
