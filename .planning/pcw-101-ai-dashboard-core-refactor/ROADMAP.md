# Roadmap: AI Dashboard Core Refactor

**Identifier:** pcw-101

---

## Phases

### Phase 01: SQLite Migration
**Status:** 📋 Planned

**Goals:**
- Remove Turso/libSQL dependency entirely
- Switch to local SQLite via `better-sqlite3` + Drizzle ORM
- Update `drizzle.config.ts`, `db/client.ts`, `packages/server/package.json`
- Update `.env.example`: remove `TURSO_*` vars, add `SQLITE_DB_PATH`
- Verify `pnpm build` passes cleanly after migration

**Plans:**
- `01-01` — Swap DB driver: uninstall libSQL, install better-sqlite3, update client + drizzle config
- `01-02` — Run fresh migration, verify schema creates correctly on local SQLite

---

### Phase 02: Task State Machine Redesign
**Status:** 📋 Planned

**Goals:**
- Replace current 7-state machine with new 9-state planning-first machine:
  `DRAFT → IN_PLANNING → PLANNED → READY_TO_CODE → QUEUED → RUNNING → AWAITING_REVIEW → APPROVED/REJECTED → COMPLETE/FAILED`
- Add `planFeedback` text field to tasks table
- Add `planningPersonaId` + `codingPersonaId` fields (separate planning vs coding personas)
- Add `planPath` field (path to `.planning/[id]-[name]/` directory in project repo)
- Update `TaskStatus` enum, `queueWorker` (only claim `READY_TO_CODE` tasks), all task routes + services
- Update frontend: `TaskStatusBadge` colors, `TaskFilterBar` options, `TaskCard` display

**Plans:**
- `02-01` — Schema changes: new fields + updated status enum, migration
- `02-02` — Backend: update taskService, queueWorker, task routes for new states
- `02-03` — Frontend: TaskStatusBadge, TaskFilterBar, TaskCard updates

---

### Phase 03: Projects System
**Status:** 📋 Planned

**Goals:**
- New `projects` table: `{ id, name, description, path, isActive }`
- Path stored as-entered (`~/projects/my-app`), resolved at runtime via `os.homedir()`
- Full CRUD: `projectService`, `routes/projects.ts`
- Path validation endpoint: `GET /api/projects/validate-path?path=` (checks dir exists)
- `ProjectListPage` + `ProjectFormPage` (create/edit)
- `ProjectSelector` dropdown replaces free-text `repoPath` in `TaskForm`
- Sidebar: add Projects link between Personas and Monitor placeholder

**Plans:**
- `03-01` — Schema + service + routes (server only)
- `03-02` — Client: API hooks + ProjectSelector component
- `03-03` — Client: ProjectListPage + ProjectFormPage + Sidebar + App router

---

### Phase 04: Planning Workflow Integration
**Status:** 📋 Planned

**Goals:**
- `sessionRunner.ts` planning mode: when task is `IN_PLANNING`, run `/start-work` + `/create-plans` (not `/run-plan`)
- Planning session resolves project path, `cd`s into repo, invokes skill stack via OpenCode
- Plan docs saved to `[projectPath]/.planning/[planPath]/` (BRIEF.md, ROADMAP.md, PLAN.md files)
- Coding mode: when task is `READY_TO_CODE`, run `/run-plan` on the appropriate PLAN.md
- Provider auth error detection: catch OpenCode auth failures, set task FAILED with clear message
- Server startup check: warn if `~/.agents/skills/start-work/` is not installed
- `queueWorker` updated: separate handlers for planning vs coding task types

**Plans:**
- `04-01` — sessionRunner planning mode: `/start-work` + `/create-plans` integration
- `04-02` — sessionRunner coding mode: `/run-plan` integration + auth error handling
- `04-03` — queueWorker: separate planning vs coding dispatch + startup skill check

---

### Phase 05: Planning UI
**Status:** 📋 Planned

**Goals:**
- `TaskDetailPage` planning section: visible when task is `IN_PLANNING`, `PLANNED`, or `READY_TO_CODE`
- BRIEF.md viewer: fetch + render markdown content from project repo (via API endpoint)
- ROADMAP.md viewer: same
- State transition controls:
  - `IN_PLANNING` → auto, set by AI when done
  - `PLANNED` → "Iterate Plan" button (shows feedback textarea) + "Mark Ready to Code" button
  - "Iterate Plan" submits feedback text → saves to `planFeedback` field → sets status back to `IN_PLANNING`
  - `READY_TO_CODE` → "Start Coding" button (manual trigger or auto via queue)
- Dual persona selector on `TaskCreatePage`: Planning Persona + Coding Persona dropdowns
- New API endpoint: `GET /api/tasks/:id/plan-doc?file=BRIEF.md` — reads file from project repo and returns content

**Plans:**
- `05-01` — Backend: plan-doc API endpoint + task update routes for new state transitions
- `05-02` — Frontend: dual persona selector on TaskCreatePage
- `05-03` — Frontend: TaskDetailPage planning section (markdown viewers + state controls)
- `05-04` — Frontend: "Iterate Plan" flow (feedback textarea + submit → IN_PLANNING)

---

### Phase 06: Setup, Portability & Documentation
**Status:** 📋 Planned

**Goals:**
- README complete rewrite: planning-first workflow, Projects setup, skill stack prerequisites, SQLite setup, PM2 deployment
- `.env.example` cleanup: only SQLite vars, clear comments
- `AGENTS.md` update: reflect current stack and conventions
- `install.md` or setup section: step-by-step first-run guide including `npx @prillcode/start-work`
- Update `00_FLOW-CHART.md` + `00_USE-CASES.md` in `.planning/` to reflect new workflow
- `pnpm build` clean pass — zero TS errors across client + server

**Plans:**
- `06-01` — README rewrite + `.env.example` + `AGENTS.md` updates
- `06-02` — Final build verification + any lingering TypeScript fixes

---

## Next Steps

1. Review and refine this ROADMAP.md
2. Run `/create-plan` to generate detailed `phases/` plans starting with Phase 01
3. Execute plans with `/run-plan`

---

## Notes

- Phases 01–03 are pure refactor/infrastructure — no visible UX change except Projects page
- Phase 04 is the core integration — most complex, depends on OpenCode SDK behavior
- Phase 05 is the UX payoff — the planning kanban comes to life here
- Phase 06 is polish + portability — important for open-sourcing
- Phase 02 (cost tracking) and Phase 03 (Skills UI) from original planning are **deferred** — not in this refactor
