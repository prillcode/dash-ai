# Phase 02 Plan 01: Schema + Migration — Summary

**Replaced 8-state TaskStatus with an 11-state machine; added planning persona + plan tracking fields; migration applied to fresh local DB.**

## Accomplishments
- Updated `schema.ts`: new `TaskStatus` const with DRAFT, IN_PLANNING, PLANNED, READY_TO_CODE, QUEUED, RUNNING, AWAITING_REVIEW, APPROVED, REJECTED, COMPLETE, FAILED
- Renamed `personaId`/`personaName` columns to `codingPersonaId`/`codingPersonaName`
- Added nullable columns: `planningPersonaId`, `planningPersonaName`, `planFeedback`, `planPath`
- Default task status changed from `PENDING` → `DRAFT`
- Rewrote migration SQL (`0000_thin_triathlon.sql`) and Drizzle snapshot directly (interactive `db:generate` rename prompts cannot be answered in non-TTY shell)
- Wiped `~/.ai-dashboard/dashboard.db` and re-applied migration cleanly

## Files Created/Modified
- `packages/server/src/db/schema.ts` — new TaskStatus, renamed + new columns, updated indexes
- `packages/server/src/db/migrations/0000_thin_triathlon.sql` — rewritten for new schema
- `packages/server/src/db/migrations/meta/0000_snapshot.json` — updated to match new schema

## Decisions Made
- Rewrote migration file directly rather than fighting non-TTY `drizzle-kit` rename prompt — safe because no production data to preserve
- `planningPersonaId` is nullable (FK to personas); planning persona is optional at task creation

## Issues Encountered
- `drizzle-kit generate` prompts interactively for rename vs. create when columns change names; cannot be answered via stdin in non-TTY environment — worked around by rewriting SQL + snapshot directly

## Next Step
Ready for 02-02-PLAN.md (backend: taskService, queueWorker, routes).
