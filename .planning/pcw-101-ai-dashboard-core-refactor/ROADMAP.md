# Roadmap: AI Dashboard Core Refactor

**Identifier:** pcw-101

---

## Phases

### Phase 01: SQLite Migration
**Status:** ✅ Complete

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
**Status:** ✅ Complete

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
**Status:** 🔄 In Progress (03-01 ✅ complete; 03-02, 03-03, 03-04 planned, not yet executed)

**Goals:**
- New `projects` table: `{ id, name, description, path, isActive }`
- Path stored as-entered (`~/projects/my-app`), resolved at runtime via `os.homedir()`
- Full CRUD: `projectService`, `routes/projects.ts`
- Path validation endpoint: `GET /api/projects/validate-path?path=` (checks dir exists)
- `ProjectListPage` + `ProjectFormPage` (create/edit)
- `ProjectSelector` dropdown replaces free-text `repoPath` in `TaskForm`
- Sidebar: add Projects link between Personas and Monitor placeholder

**Plans:**
- `03-01` ✅ — Persona provider/model picker + type presets (executed + committed)
- `03-02` 📋 — Server: projects table + projectService + routes/projects.ts
- `03-03` 📋 — Client: types + API hooks + ProjectSelector + TaskForm update
- `03-04` 📋 — Client: ProjectListPage + ProjectFormPage + Sidebar + App router

---

### Phase 04: Planning Workflow Integration
**Status:** 📋 Planned — all plans written, ready for execution

**Goals:**
- `sessionRunner.ts` planning mode: when task is `IN_PLANNING`, run `/start-work` + `/create-plans` (not `/run-plan`)
- Planning session resolves project path, `cd`s into repo, invokes skill stack via OpenCode SDK
- Plan docs saved to `[projectPath]/.planning/[planPath]/` (BRIEF.md, ROADMAP.md, PLAN.md files)
- Coding mode: when task is `READY_TO_CODE`, run `/run-plan` on the appropriate PLAN.md
- Provider auth error detection: catch auth failures, set task FAILED with clear message
- Server startup check: warn if `~/.agents/skills/start-work/` is not installed
- `queueWorker` updated: separate handlers for planning vs coding task types

**Plans:**
- `04-01` 📋 — planningRunner.ts: SDK/CLI integration + startup skill check + queueWorker planning dispatch
- `04-02` 📋 — codingRunner.ts: /run-plan integration + auth error detection; sessionRunner refactor
- `04-03` 📋 — Task routes: start-planning, iterate-plan, plan-doc API endpoints

---

### Phase 05: Planning UI
**Status:** 📋 Planned — all plans written, ready for execution

**Goals:**
- `TaskDetailPage` planning section: visible when task is `IN_PLANNING`, `PLANNED`, or `READY_TO_CODE`
- BRIEF.md viewer: fetch + render markdown content from project repo (via API endpoint)
- ROADMAP.md viewer: same
- State transition controls:
  - `IN_PLANNING` → auto, set by AI when done
  - `PLANNED` → "Iterate Plan" button (shows feedback textarea) + "Mark Ready to Code" button
  - "Iterate Plan" submits feedback text → saves to `planFeedback` field → sets status back to `IN_PLANNING`
  - `READY_TO_CODE` → auto via queue
- Dual persona selector on `TaskCreatePage`: Planning Persona + Coding Persona dropdowns

**Plans:**
- `05-01` 📋 — Client: planning API hooks + TaskForm dual-persona dropdowns + PlanningSection stub
- `05-02` 📋 — Client: PlanDocViewer markdown rendering + action buttons (Start Planning, Mark Ready to Code)
- `05-03` 📋 — Client: IteratePlanForm + human verification checkpoint

---

### Phase 06: Setup, Portability & Documentation
**Status:** 📋 Planned — all plans written, ready for execution

**Goals:**
- README complete rewrite: planning-first workflow, Projects setup, skill stack prerequisites, SQLite setup, PM2 deployment
- `.env.example` cleanup: only SQLite vars, clear comments
- `AGENTS.md` update: reflect current stack and conventions
- `pnpm build` clean pass — zero TS errors across client + server
- ISSUES.md for any deferred items

**Plans:**
- `06-01` 📋 — README rewrite + `.env.example` + `AGENTS.md` updates
- `06-02` 📋 — Final build verification + TypeScript fixes + startup smoke test + human checkpoint

---

### Phase 07: Config Menu & Models Setup
**Status:** 📋 Planned

**Goals:**
- Add "Config" menu option to sidebar with "Setup Models" page
- Replace models.json file with database table for model configurations
- Allow users to define AI models (provider, model ID, API key storage optional)
- Integrate with existing persona system for model selection
- Provide UI to test model connectivity

**Plans:**
- `07-01` 📋 — Database: create models table, migration, service
- `07-02` 📋 — Server: routes for CRUD, model validation, test endpoint
- `07-03` 📋 — Client: Config menu, Models page, form components
- `07-04` 📋 — Integration: update persona creation to use models table, migrate existing models.json

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
