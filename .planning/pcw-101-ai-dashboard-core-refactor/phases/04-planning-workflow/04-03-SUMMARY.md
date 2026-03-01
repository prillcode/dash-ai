# Phase 04 Plan 03: Planning API Endpoints — Summary

**Added server-side API surface needed by the Planning UI: start-planning, iterate-plan, and plan-doc endpoints.**

## Accomplishments
- Added `POST /api/tasks/:id/start-planning` — transitions DRAFT → IN_PLANNING with validation (planning persona must be assigned)
- Added `POST /api/tasks/:id/iterate-plan` — accepts feedback, saves planFeedback, transitions PLANNED → IN_PLANNING, emits PLAN_FEEDBACK event
- Updated `statusUpdateSchema` to include `COMPLETE` status for manual transitions
- Added `GET /api/tasks/:id/plan-doc?file=BRIEF.md` — reads plan documents from the project repo with allowed‑files whitelist (BRIEF.md, ROADMAP.md, ISSUES.md)
- Added `readPlanDoc` helper in `taskService.ts` that resolves paths and returns content or null
- Extended `EventType` union with `PLAN_FEEDBACK` and added corresponding `PlanFeedbackPayload`

## Files Created/Modified
- `packages/server/src/routes/tasks.ts` (three new endpoints, iterate‑plan schema, status‑update schema extended)
- `packages/server/src/services/taskService.ts` (`readPlanDoc` helper, imports for fs/promises, fs, path)
- `packages/server/src/services/eventService.ts` (added `PlanFeedbackPayload`, extended `EventType`)

## Decisions Made
- Use whitelist for plan‑doc file param to prevent directory traversal (allowed: BRIEF.md, ROADMAP.md, ISSUES.md)
- `planFeedback` stored via `updateTaskStatus` extra param (already supported)
- `PLAN_FEEDBACK` event payload matches `PlanFeedbackPayload` interface (`feedback: string`)
- `start‑planning` endpoint returns 400 if task already not DRAFT or missing planning persona
- `iterate‑plan` endpoint returns 400 if task not PLANNED

## Issues Encountered
- TypeScript error: `"PLAN_FEEDBACK"` not in `EventType` — added to union and created payload interface
- No other issues; build passes clean

## Next Step
Phase 04 backend complete — ready for Phase 05: Planning UI.