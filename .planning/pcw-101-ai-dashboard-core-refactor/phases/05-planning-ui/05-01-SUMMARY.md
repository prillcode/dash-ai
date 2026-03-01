# Phase 05 Plan 01: Planning UI Foundation — Summary

**Added three missing TanStack Query hooks, PersonaSelector filterType prop, PlanningSection stub, and wired it into TaskDetailPage.**

## Accomplishments
- Added `useIteratePlan`, `usePlanDoc`, `useMarkReadyToCode` hooks to `api/tasks.ts`
- Added optional `filterType` prop to `PersonaSelector` (filters by `personaType`; coder filter also includes "custom" personas)
- Created `PlanningSection.tsx` stub rendering per status: DRAFT (Start Planning button), IN_PLANNING (pulsing message), PLANNED (status + action area), READY_TO_CODE (queue message)
- Inserted `PlanningSection` as first element in `TaskDetailPage` left column
- Created `PlanDocViewer.tsx` and `IteratePlanForm.tsx` stubs (full implementation in 05-02/05-03)
- Exported all three new components from `components/tasks/index.ts`

## Files Created/Modified
- `packages/client/src/api/tasks.ts` (added three hooks)
- `packages/client/src/components/personas/PersonaSelector.tsx` (added optional `filterType` prop)
- `packages/client/src/components/tasks/PlanningSection.tsx` (new)
- `packages/client/src/components/tasks/PlanDocViewer.tsx` (new)
- `packages/client/src/components/tasks/IteratePlanForm.tsx` (new)
- `packages/client/src/components/tasks/index.ts` (added exports)
- `packages/client/src/pages/TaskDetailPage.tsx` (inserted PlanningSection)

## Decisions Made
- `PlanningSection` hides entirely for tasks without a `planningPersonaId` in non-planning states
- `PersonaSelector filterType="coder"` also includes `personaType === "custom"` personas per spec
- `Task` type already had `planPath` and `planFeedback` fields (added previously)

## Issues Encountered
- `node_modules` not installed in environment; ran `pnpm install` before build — resolved

## Next Step
Ready for 05-02 (plan doc viewers + action buttons) — already implemented in the same pass.
