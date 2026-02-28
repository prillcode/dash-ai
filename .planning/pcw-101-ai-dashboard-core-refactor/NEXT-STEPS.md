# Next Steps — pcw-101 AI Dashboard Core Refactor

All PLAN.md files are written through Phase 06. No more planning needed — just execute.

---

## Where We Are

| Phase | Status | Plans |
|-------|--------|-------|
| 01 — SQLite Migration | ✅ Complete | — |
| 02 — Task State Machine | ✅ Complete | — |
| 03 — Projects System | 🔄 In Progress | 03-01 ✅ done; 03-02/03/04 ready |
| 04 — Planning Workflow | 📋 Ready | 04-01, 04-02, 04-03 written |
| 05 — Planning UI | 📋 Ready | 05-01, 05-02, 05-03 written |
| 06 — Setup & Docs | 📋 Ready | 06-01, 06-02 written |

---

## Execution Order

Pick up from **03-02** and run plans sequentially. Each plan is independently
committable. Do not skip ahead — later plans reference earlier SUMMARY.md files.

```
03-02 → 03-03 → 03-04
04-01 → 04-02 → 04-03
05-01 → 05-02 → 05-03
06-01 → 06-02
```

### To run a plan

Use the `/run-plan` slash command:
```
/run-plan .planning/pcw-101-ai-dashboard-core-refactor/phases/03-projects-system/03-02-PLAN.md
```

---

## Key Reminders

- **Never run `pnpm db:generate`** — write migration SQL manually (see AGENTS.md)
- **Never wipe the DB** (`~/.ai-dashboard/dashboard.db`) unless explicitly resetting data
- **SDK is OpenCode** (`@opencode-ai/sdk`) — not Claude Code SDK
- **nvm required**: always source `export NVM_DIR="$HOME/.nvm" && source "$NVM_DIR/nvm.sh" && nvm use v22` before running pnpm commands
- Migrations are gitignored — don't try to `git add` them
- Each plan writes a SUMMARY.md on completion — that file's existence = plan done

## Critical Context

- `planningRunner.ts` (04-01) must audit what OpenCode SDK/CLI is actually installed
  before choosing Option A (SDK), B (CLI spawn), or C (placeholder)
- Phase 04 plans are kept intentionally coarser — OpenCode SDK behavior is unknown until runtime
- Human verify checkpoints in 03-04, 05-03, and 06-02 require manual browser testing
- `GET /api/models` must stay BEFORE `authMiddleware` in `index.ts` (already done, don't break it)

---

## Commit Convention

```
feat(pcw-101-03-02): <description>   ← for executed plans
chore:                                ← for docs/planning only
fix(pcw-101-XX):                      ← for bug fixes
```
