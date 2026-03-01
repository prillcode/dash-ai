# Phase 05 Plan 02: Plan Doc Viewers + Action Buttons — Summary

**Implemented PlanDocViewer with marked markdown rendering and wired all planning action buttons into PlanningSection; removed duplicate Approve/Reject buttons from TaskActionBar.**

## Accomplishments
- `PlanDocViewer.tsx`: fetches plan docs via `usePlanDoc`, renders with `marked.parse()` using `dangerouslySetInnerHTML`, shows collapsible `<details>` per document
- `PlanningSection` renders BRIEF.md and ROADMAP.md viewers in PLANNED and READY_TO_CODE states (when `planPath` is set)
- PLANNED state action buttons: "Mark Ready to Code" (→ `useMarkReadyToCode`) and "Iterate Plan" (→ toggles `IteratePlanForm`)
- DRAFT state action button: "Start Planning" (→ `useStartPlanning`) — shown only when `planningPersonaId` is set
- READY_TO_CODE state: informational "in queue" message only, no actions
- Removed `handleApprovePlan` / `handleRejectPlan` from `TaskActionBar` — PLANNED state now returns `null` with a comment directing to `PlanningSection`

## Markdown Renderer Chosen
**`marked`** — already installed in the client package (used in `TaskForm.tsx` description preview). No new dependency needed.

## Files Created/Modified
- `packages/client/src/components/tasks/PlanDocViewer.tsx` (full implementation)
- `packages/client/src/components/tasks/PlanningSection.tsx` (doc viewers + action buttons wired)
- `packages/client/src/components/tasks/TaskActionBar.tsx` (removed PLANNED Approve/Reject, returns null with comment)

## Decisions Made
- `PlanningSection` owns all planning state transitions (DRAFT→IN_PLANNING, PLANNED→READY_TO_CODE, PLANNED→IN_PLANNING via iterate)
- `TaskActionBar` owns all other state transitions (coding queue, cancel, approve/reject diff review)
- `dangerouslySetInnerHTML` acceptable — content from user's local repo files only
- `prose prose-sm` Tailwind classes applied; `@tailwindcss/typography` already present in Tailwind v4 setup

## Issues Encountered
- None; `marked` was already installed, build passed clean

## Next Step
Ready for 05-03 (IteratePlanForm — already implemented in same pass).
