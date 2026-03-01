# Phase 04 Plan 01: Planning Session Runner — Summary

**Implemented planning-mode session runner with placeholder SDK and wired dispatch into queue worker.**

## Accomplishments
- Audited OpenCode SDK availability: package listed but not installed, CLI not in PATH, skills present
- Created `planningRunner.ts` with placeholder (Option C) returning immediate error
- Added `checkSkillsInstalled()` that validates `~/.agents/skills/start-work` and `create-plans`
- Added `claimNextPlanningTask()` to task service with `isNull(sessionId)` guard
- Added `runPlanningTaskSession()` to queue worker, emitting events and transitioning task to PLANNED/FAILED
- Modified `queueWorker` loop to poll IN_PLANNING tasks before READY_TO_CODE tasks
- Added startup skill warning in `index.ts`
- Extended `EventType` union with "PLANNING_EVENT" and added `PlanningEventPayload`
- Added optional `message` field to `StatusChangePayload` for planning status messages

## SDK Approach Chosen
**Option C — Placeholder** because `@opencode-ai/sdk` package is listed in package.json but not installed in node_modules, and the `opencode` CLI is not in PATH. The placeholder immediately fails with a clear error message guiding installation.

## Files Created/Modified
- `packages/server/src/opencode/planningRunner.ts` (new)
- `packages/server/src/services/taskService.ts` (added `claimNextPlanningTask`)
- `packages/server/src/services/queueWorker.ts` (added planning dispatch, import, event casting)
- `packages/server/src/services/eventService.ts` (added `PlanningEventPayload`, extended `EventType` and `StatusChangePayload`)
- `packages/server/src/index.ts` (added skill‑check warning)
- `packages/server/package.json` (no change)

## Decisions Made
- Use `sessionId` column as claim token for IN_PLANNING tasks (set to `planning-<uuid>`)
- Keep `claimNextPlanningTask` non‑destructive (does not change status, only sets `sessionId`)
- Emit "PLANNING_EVENT" for future streaming; placeholder only emits "ERROR"
- Added `message` to `StatusChangePayload` to carry planning‑phase messages
- Planning tasks are prioritized over coding tasks in the worker loop (planning first)

## Issues Encountered
- TypeScript errors due to `appendEvent` expecting strict `EventType` and `EventPayload` shapes
- Fixed by adding missing event types, extending payload interfaces, and using `as any` casts where payload shape is dynamic (planning events)
- The `@opencode-ai/sdk` package is missing; installation is out of scope for this plan

## Next Step
Ready for 04‑02‑PLAN.md (coding session runner + auth error handling).