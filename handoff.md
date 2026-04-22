# Dash AI Handoff

## Repo / Branch
- Project: `dash-ai`
- Branch at handoff: `main`
- Primary active work item: `DA-07` — Coding Iteration + Review UX

## Current Status
DA-06 is considered closed for its intended scope.

DA-07 is the active follow-on. Phase 01 is implemented and build-verified. The next session should continue with DA-07 Phase 02.

## Important Completed Work
Implementation milestone commit:
- `b268910` — `feat(da-07-01): add explicit coding queue and iteration flow`

What that commit changed:
- `READY_TO_CODE` no longer acts like an auto-run trigger.
- Added explicit coding queue endpoint: `POST /api/tasks/:id/queue-coding`.
- Added coding follow-up endpoint: `POST /api/tasks/:id/iterate-coding`.
- Added persisted task field `coding_feedback` via additive migration `0003_add_task_coding_feedback.sql`.
- Queue worker now claims `QUEUED` tasks instead of auto-running `READY_TO_CODE` tasks.
- Coding runner prompt now accepts latest coding feedback and frames follow-up runs as continuation from current repo state.
- Client now has explicit queueing and a coding follow-up feedback form.
- Timeline and task detail now surface coding feedback.
- Cancel/reset semantics for queued/running coding now return to `READY_TO_CODE` instead of dropping all the way back to `DRAFT`.

## Files Most Relevant Next Session
Planning docs:
- `.planning/DA-07-coding-iteration-review-ux/BRIEF.md`
- `.planning/DA-07-coding-iteration-review-ux/ROADMAP.md`
- `.planning/DA-07-coding-iteration-review-ux/phases/01-01-PLAN.md`
- `.planning/DA-07-coding-iteration-review-ux/phases/01-01-SUMMARY.md`
- `.planning/DA-07-coding-iteration-review-ux/phases/02-01-PLAN.md`

Server:
- `packages/server/src/routes/tasks.ts`
- `packages/server/src/services/taskService.ts`
- `packages/server/src/services/queueWorker.ts`
- `packages/server/src/agent/codingRunner.ts`
- `packages/server/src/db/schema.ts`
- `packages/server/src/db/migrations/0003_add_task_coding_feedback.sql`

Client:
- `packages/client/src/api/tasks.ts`
- `packages/client/src/components/tasks/TaskActionBar.tsx`
- `packages/client/src/components/tasks/IterateCodingForm.tsx`
- `packages/client/src/components/tasks/PlanningSection.tsx`
- `packages/client/src/components/timeline/TaskTimelinePanel.tsx`
- `packages/client/src/pages/TaskDetailPage.tsx`
- `packages/client/src/types/task.ts`
- Later DA-07 work will also touch `packages/client/src/components/diff/*`

## What Is Done vs Not Done
### Done in DA-07 Phase 01
- Explicit separation of plan approval (`READY_TO_CODE`) from coding execution (`QUEUED` / worker claim).
- First-class coding follow-up action with persisted feedback.
- Basic iteration-aware coding prompt wiring.
- Initial UI affordances for queueing and continue-with-feedback.
- Build verification via `pnpm build`.

### Still Not Done
- DA-07 Phase 02: deepen runner continuation behavior and diagnostics.
- DA-07 Phase 03: refresh review actions/labels beyond approve/reject.
- DA-07 Phase 04: replace raw diff panel with changed-files summary.

## Recommended Next Step
Start with:
- `.planning/DA-07-coding-iteration-review-ux/phases/02-01-PLAN.md`

Goal of the next session:
- tighten the iteration prompt contract and diagnostics so follow-up coding runs are clearly distinguished from fresh runs and use repo state/feedback more intentionally.

Concrete next tasks:
1. Audit current `codingRunner` prompt/event payloads.
2. Decide whether `codingFeedback` should be cleared at run start, on success, or only when replaced.
3. Add clearer diagnostics for fresh vs iterative coding runs in timeline/events.
4. Re-run `pnpm build` after changes.
5. Then move into Phase 03 review UX and Phase 04 changed-files summary work.

## Notes / Nuances
- Some Phase 02 work was lightly started during Phase 01 because the runner already accepts and forwards `codingFeedback`. The next session should treat Phase 02 as refinement/hardening rather than starting from zero.
- The raw diff panel is still present. That work was intentionally left for later DA-07 phases.
- The post-coding action model is only partially improved so far: there is now a continue-with-feedback path, but the broader review UX overhaul is still pending.

## Database / Migration Notes
Follow project migration rules from `AGENTS.md`:
- Do **not** wipe the DB.
- Do **not** run `pnpm db:generate`.
- Migration already added manually:
  - `packages/server/src/db/migrations/0003_add_task_coding_feedback.sql`
- On a machine that needs the schema update, run:
  - `pnpm db:migrate`

## Verification Already Performed
- `pnpm build` completed successfully after Phase 01 implementation.

## Suggested Bootstrap On New Machine
1. Clone / open repo.
2. `pnpm install`
3. `pnpm db:migrate`
4. `pnpm build`
5. Read the DA-07 planning docs listed above.
6. Continue with Phase 02 implementation.

## Suggested Prompt For New Pi Session
You are continuing DA-07 in Dash AI. DA-06 is closed. DA-07 Phase 01 is already implemented and committed in `b268910` with explicit coding queueing, persisted coding feedback, and a continue-with-feedback flow. Read `handoff.md`, `.planning/DA-07-coding-iteration-review-ux/BRIEF.md`, `ROADMAP.md`, `phases/01-01-SUMMARY.md`, and `phases/02-01-PLAN.md`, then execute DA-07 Phase 02 and validate with `pnpm build`.
