> **Planning Instructions**
> When using `/create-plan` for this work:
> - Create plans in the `phases/` subdirectory
> - Reference this BRIEF.md for work context and scope
> - **Identifier:** `pcw-101`
> - **Commits:**
>   - Subagent: Use `feat(pcw-101-01):`, `fix(pcw-101-02):`, etc.
>   - Manual: Use standard prefixes without identifier

---

# Work: AI Dashboard Core Refactor

**Identifier:** pcw-101
**Type:** Refactor

## Objective

Refactor ai-dashboard from its initial scaffolded state into a focused, portable, planning-first AI kanban board. The core purpose is a self-hosted tool for managing coding/development tasks across multiple local repos, with a structured planning phase (AI-assisted spec creation) before any code execution begins. The refactor eliminates scope creep (cost tracking, Skills UI), migrates from cloud Turso to local SQLite for portability, redesigns the task state machine to support a planning-first workflow, adds a Projects system for managing local repos, and integrates the `start-work` / `create-plans` / `run-plan` skill stack as the planning engine.

## Scope

**Included:**
- Migrate database from Turso (cloud libSQL) to local SQLite (`better-sqlite3`)
- Redesign task state machine: `DRAFT → IN_PLANNING → PLANNED → READY_TO_CODE → QUEUED → RUNNING → AWAITING_REVIEW → APPROVED/REJECTED → COMPLETE/FAILED`
- Add `planFeedback` text field to tasks (Option A — simple, no extra table)
- Add `Projects` system: register local repos by name + path, select in TaskCreatePage
- Integrate planning workflow: AI triggers `/start-work` + `/create-plans` in planning phase, saves plan docs to repo's `.planning/` directory
- Two persona modes per task: Planning Persona + Coding Persona (optional Code Reviewer)
- Planning UI: view BRIEF.md / ROADMAP.md in-app, "Iterate Plan" button with feedback textarea, state transition controls
- Provider auth error handling in `sessionRunner.ts`: detect OpenCode auth failures, surface clear message to user
- Setup step: check for `start-work` skill at server startup, warn if missing
- README rewrite: document the full planning-first workflow, Projects setup, skill stack dependency
- Update `.env.example`: remove Turso vars, add SQLite path var

**Excluded:**
- Phase 2: Cost tracking / Monitor page (deferred — not core workflow)
- Phase 3: Skills management UI (deferred — users manage skills via `~/.agents/skills/` directly)
- GitHub integration / remote repo auth (local repos only)
- Multi-user / team features

## Context

**Current State:**
- Phase 1 scaffolded and functional: Hono backend, React frontend, Turso DB connected
- Auth working (Bearer token via `VITE_API_TOKEN` + `API_TOKEN`)
- Basic CRUD for tasks and personas operational
- `sessionRunner.ts` is a placeholder — OpenCode SDK not yet integrated
- Task states: `PENDING → QUEUED → RUNNING → AWAITING_REVIEW → APPROVED/REJECTED → COMPLETE/FAILED`
- Free-text `repoPath` field on task form (no validation, error-prone)
- No planning phase — tasks go straight to execution queue
- Ad-hoc planning docs in `.planning/` (old handoff format, not start-work structure)

**Key Files:**
- `packages/server/src/db/schema.ts` — current Drizzle schema (Turso/libSQL)
- `packages/server/src/db/client.ts` — Turso client setup
- `packages/server/drizzle.config.ts` — Turso dialect config
- `packages/server/src/opencode/sessionRunner.ts` — placeholder, needs full implementation
- `packages/server/src/services/queueWorker.ts` — polls for PENDING tasks
- `packages/server/src/middleware/auth.ts` — Bearer token auth
- `packages/client/src/components/tasks/TaskForm.tsx` — has free-text repoPath field
- `packages/client/src/pages/TaskDetailPage.tsx` — needs planning UI added
- `packages/client/src/layouts/Sidebar.tsx` — needs Projects link
- `packages/client/src/App.tsx` — needs Projects + planning routes
- `.env` — contains Turso credentials (to be replaced)
- `.planning/` — legacy handoff docs (keep as reference, not executed)

**Tech Stack:**
- Runtime: Node.js LTS
- Backend: Hono + `@hono/node-server`
- Database: Drizzle ORM → migrating from `@libsql/client` (Turso) to `better-sqlite3` (local)
- Frontend: React 18 + TypeScript + Vite + Tailwind CSS v3
- Data fetching: TanStack Query v5
- Forms: React Hook Form + Zod
- AI execution: OpenCode SDK (placeholder, to be implemented)
- Planning skill stack: `start-work` + `create-plans` + `run-plan` (at `~/.agents/skills/`)

**Skills available on this machine:**
- `~/.agents/skills/start-work/` — scaffolds `.planning/[id]-[name]/` with BRIEF + ROADMAP
- `~/.agents/skills/create-plans/` — reads BRIEF/ROADMAP, generates executable PLAN.md files
- `~/.claude/commands/run-plan.md` — executes a specific PLAN.md via subagent

## Success Criteria

- [ ] App runs with zero cloud dependencies (local SQLite only, no Turso account needed)
- [ ] New task state machine fully implemented in DB schema, backend, and frontend
- [ ] Projects page: create/edit/delete local repo registrations with path validation
- [ ] TaskCreatePage: ProjectSelector replaces free-text repoPath field
- [ ] Planning phase: selecting a Planning Persona + clicking "Start Planning" triggers AI to run `/start-work` + `/create-plans` in the project repo
- [ ] Plan docs (BRIEF.md, ROADMAP.md, PLAN.md files) are saved in the project repo's `.planning/` directory
- [ ] Task detail page shows BRIEF.md and ROADMAP.md content when task is in planning states
- [ ] "Iterate Plan" button visible in PLANNED state — accepts feedback text, re-triggers IN_PLANNING
- [ ] "Mark Ready to Code" button moves task from PLANNED → READY_TO_CODE
- [ ] Coding phase only starts when task is READY_TO_CODE
- [ ] Provider auth errors surface clear user message (not raw SDK error)
- [ ] Server warns at startup if `start-work` skill is not installed
- [ ] `pnpm build` passes with zero TypeScript errors
- [ ] README documents the full workflow end-to-end
