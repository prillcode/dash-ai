# Roadmap: Coding Runner Hardening

**Identifier:** DA-06

## Recommended Mode
Full planning scaffold.

Reasoning:
- This work spans backend validation, live session lifecycle control, UX affordances, and verification.
- Some fixes are low-risk guards, while others affect active runtime behavior and should be implemented incrementally.

## Phases

### Phase 01: Coding Entry Validation and UX Guardrails
**Status:** 📋 Planned

**Goals:**
- Prevent coding from starting without an executable plan
- Remove or constrain misleading UI actions that imply coding can start safely without planning output
- Ensure ready-to-code transitions are validated server-side

**Expected outputs:**
- Validation for executable `PLAN.md` / `EXECUTION.md`
- Safer `READY_TO_CODE` gating
- Updated task action UI for coding entry

**Verification:**
- Tasks without executable plans cannot be queued for coding
- UI no longer offers unsafe coding actions for plan-less tasks

---

### Phase 02: Real Cancellation and Session Lifecycle Control
**Status:** 📋 Planned

**Goals:**
- Make cancel actually abort live coding sessions
- Handle queued vs running cancellation paths coherently
- Avoid leaking stale active session handles

**Expected outputs:**
- In-memory session tracking for active coding tasks
- Abort wiring from task actions/routes to live sessions
- Clear status/error behavior for canceled sessions

**Verification:**
- Canceling a running coding task aborts the live session
- Canceled tasks do not continue writing events/diffs as if still active

---

### Phase 03: No-Op Run Handling and Coding Diagnostics
**Status:** 📋 Planned

**Goals:**
- Surface empty-diff coding runs explicitly
- Persist coding metadata early enough for debugging
- Improve visibility of selected execution docs and outcomes

**Expected outputs:**
- Explicit handling for empty/no-op coding outcomes
- Early persistence of session metadata
- Better coding summary events / task diagnostics

**Verification:**
- Empty-diff sessions are clearly distinguishable from successful implementation runs
- Session id / selected execution doc are visible before task completion

---

### Phase 04: Planning-Artifact Guardrails and End-to-End Verification
**Status:** 📋 Planned

**Goals:**
- Prevent coding from drifting into unrelated `.planning/*` work items
- Re-verify the full coding flow end-to-end after hardening
- Add minimal UX follow-through if needed

**Expected outputs:**
- Narrow `.planning` artifact guardrails for coding
- Verification notes for queue → run → cancel / success / no-op paths
- Final hardening summary

**Verification:**
- Coding stays within the intended work item’s planning artifacts
- Manual verification confirms safer coding behavior and clean build output

## Likely Files To Change
- `packages/server/src/agent/codingRunner.ts`
- `packages/server/src/services/queueWorker.ts`
- `packages/server/src/routes/tasks.ts`
- `packages/server/src/services/taskService.ts`
- `packages/server/src/services/eventService.ts`
- `packages/client/src/components/tasks/TaskActionBar.tsx`
- `packages/client/src/components/tasks/PlanningSection.tsx`
- `packages/client/src/pages/TaskDetailPage.tsx`
- `packages/client/src/components/timeline/TaskTimelinePanel.tsx`

## Lightweight Verification Checklist
- Try to queue a task with no executable plan and confirm it is blocked
- Start a valid coding task and confirm selected execution doc/session id appear early
- Cancel a running coding task and confirm the live session stops
- Run a no-op coding task and confirm it does not silently become review-ready
- Confirm coding does not touch unrelated `.planning/*` work items
- Run `pnpm build`

## Next Step
Next step: execute Phase 01 for coding entry validation and keep coding iteration / review UX improvements tracked separately in **DA-07**.
