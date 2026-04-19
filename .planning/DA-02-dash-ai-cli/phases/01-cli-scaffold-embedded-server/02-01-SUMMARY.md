# DA-02 Phase 01 Summary — CLI Scaffold + Embedded Server Bootstrap

**Date**: 2026-04-19

## What Was Done

### CLI Package (`packages/cli/`)
- `package.json` — commander, chalk, ora, ws, zod, tsup
- `tsconfig.json` — ESNext + Bundler resolution
- `tsup.config.ts` — ESM bundle for clean Node.js execution
- `src/index.ts` — commander-based CLI entry point with global `--url`/`--token` flags

### Core Modules
- `src/context.ts` — `CliContext` interface with url, token, json, quiet, color
- `src/api/client.ts` — `DashAiClient` with full HTTP verb methods + typed `ApiError` with exit codes
- `src/api/resolver.ts` — `resolveClient()` (thin vs embedded) + `withClient()` helper
- `src/api/poll.ts` — `pollTaskStatus()` + `Task` type
- `src/embedded/server.ts` — `ensureEmbeddedServer()` / `teardownEmbeddedServer()`; spawns server as subprocess via `tsx` on a random port; waits for `/api/health` readiness
- `src/output/format.ts` — `formatTable()` (no external dep), chalk colors, `printSuccess/Error/Warn`

### Commands
- `src/commands/config.ts` — `config list`
- `src/commands/projects.ts` — `projects list`, `projects show <id>`
- `src/commands/personas.ts` — `personas list`, `personas show <name-or-id>`
- `src/commands/tasks.ts` — full task lifecycle: `list`, `create`, `show`, `plan`, `plan-docs`, `approve-plan`, `diff`, `review`, `approve`, `reject`, `wait`, `watch`

### Embedded Server Architecture
- Server runs as a **subprocess** via `tsx packages/server/src/index.ts`
- Avoids workspace module resolution issues entirely
- Server reads `PORT`, `API_TOKEN`, `SQLITE_DB_PATH` from environment
- CLI waits for `/api/health` before returning control to commands

### Key Design Decisions
- **Subprocess over in-process**: cleaner separation, no shared TypeScript compilation context
- **tsup for CLI build**: bundles ESM without requiring `.js` extensions on imports
- **Default DB**: embedded server uses `~/.dash-ai/dashboard.db` (same as standalone server)

## Verification
```
$ dash-ai personas list     → lists personas via embedded server ✓
$ dash-ai projects list      → lists projects ✓
$ dash-ai tasks list         → lists tasks ✓
$ dash-ai config list        → shows config (no server needed) ✓
$ dash-ai --help             → shows all commands ✓
```

## Notes
- `serveStatic` warning is benign (client dist not built in this context)
- Queue worker DB errors for missing tables are expected if migrations not run
- Concurrency limit still 3 from DA-01 (Pi sessions are memory-heavy)
