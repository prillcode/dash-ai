# Phase 02 Plan 02: Backend — taskService, queueWorker, routes — Summary

**Backend updated to drive the new 11-state machine; queue now claims READY_TO_CODE tasks; server build passes clean.**

## Accomplishments
- `taskService.ts`: updated `TaskInput` to use `codingPersonaId`/`codingPersonaName`/`planningPersonaId`/`planningPersonaName`; `createTask` defaults to `DRAFT`; `claimNextReadyTask` claims `READY_TO_CODE` (old `claimNextPendingTask` kept as alias); `resetStuckTasks` now also resets `IN_PLANNING` → `DRAFT`; `updateTaskStatus` extra Partial extended with `planFeedback`, `planPath`, `planningPersonaId`, `planningPersonaName`
- `queueWorker.ts`: uses `claimNextReadyTask`, looks up `codingPersonaId`, emits `READY_TO_CODE → QUEUED` event, updated startup log
- `routes/tasks.ts`: `taskSchema` accepts `codingPersonaId` + optional `planningPersonaId`; `statusUpdateSchema` allows manual transitions to DRAFT, PLANNED, READY_TO_CODE, APPROVED, REJECTED, FAILED; POST handler looks up both personas
- `pnpm --filter server build` passes with zero TypeScript errors

## Files Created/Modified
- `packages/server/src/services/taskService.ts` — updated TaskInput, createTask, claimNextReadyTask, resetStuckTasks, updateTaskStatus
- `packages/server/src/services/queueWorker.ts` — updated persona lookup, event payloads, claim call
- `packages/server/src/routes/tasks.ts` — updated schemas, POST handler, status event

## Decisions Made
- Manual status update emits `STATUS_CHANGE` event (not `REVIEW_ACTION`) to avoid typing the action field as only APPROVED/REJECTED — cleaner for the broader set of manual transitions now allowed
- `claimNextPendingTask` kept as alias so any future code referencing it doesn't break immediately

## Issues Encountered
- `REVIEW_ACTION` event payload type required `action: "APPROVED" | "REJECTED"` — manual status update now covers more states, so switched to `STATUS_CHANGE` with `from: "manual"`

## Next Step
Ready for 02-03-PLAN.md (frontend: types, badges, form, cascade fixes).
