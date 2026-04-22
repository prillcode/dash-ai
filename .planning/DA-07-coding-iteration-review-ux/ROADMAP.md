# Roadmap: Coding Iteration + Review UX

**Identifier:** DA-07

## Recommended Mode
Full planning scaffold.

Reasoning:
- This work spans task workflow semantics, coding continuation behavior, and task-detail UI changes.
- It should be implemented incrementally so state-model and UX changes are easy to verify.

## Phases

### Phase 01: Coding Iteration Workflow and Status Model
**Status:** ✅ Completed

**Goals:**
- Add a user-facing coding iteration / continue-with-feedback workflow
- Split plan approval from execution so `READY_TO_CODE` does not auto-run
- Define the minimum task-state changes needed for iterative coding
- Persist coding feedback cleanly

**Expected outputs:**
- Coding iteration API/action design
- Status model and persistence decisions, including an explicit pre-run vs queued/run distinction
- UI feedback form / action entry point plan

**Verification:**
- A partial coding task can accept follow-up feedback and re-enter coding coherently
- A task can remain `READY_TO_CODE` without auto-starting until the user explicitly queues/runs it

---

### Phase 02: Coding Runner Continuation Behavior
**Status:** 📋 Planned

**Goals:**
- Make codingRunner continue intelligently from current repo state plus user feedback
- Preserve selected plan context while avoiding redundant rework

**Expected outputs:**
- Iteration-aware coding prompt contract
- Queue/runner behavior for continued coding sessions
- Clear diagnostics for iteration vs fresh coding runs

**Verification:**
- Iterated coding runs reflect user feedback and current repo state cleanly

---

### Phase 03: Review Action UX Refresh
**Status:** 📋 Planned

**Goals:**
- Replace the current approve/reject-only mental model with clearer post-coding actions
- Reflect that code may already exist in the repo before final user acceptance

**Expected outputs:**
- Updated task action controls and labels
- Improved task detail messaging for partial, blocked, and iterated coding runs

**Verification:**
- Users can understand what to do after partial coding progress without abusing reject/retry

---

### Phase 04: Diff Panel Replacement with Changed-Files Summary
**Status:** 📋 Planned

**Goals:**
- Replace or simplify the raw unified diff preview panel
- Show a concise file-change summary with add/delete counts

**Expected outputs:**
- Changed-files summary UI fed from the stored diff artifact or equivalent analysis
- Optional advanced access to raw diff only if still useful

**Verification:**
- Task detail shows useful changed-file summaries instead of dumping `diff --git` output by default
- Add/delete counts are visible per file

## Likely Files To Change
- `packages/server/src/routes/tasks.ts`
- `packages/server/src/services/taskService.ts`
- `packages/server/src/db/schema.ts` *(if new persistence fields/states are needed)*
- `packages/server/src/agent/codingRunner.ts`
- `packages/server/src/services/queueWorker.ts`
- `packages/client/src/components/tasks/TaskActionBar.tsx`
- `packages/client/src/pages/TaskDetailPage.tsx`
- `packages/client/src/components/diff/*`
- `packages/client/src/components/timeline/TaskTimelinePanel.tsx`

## Lightweight Verification Checklist
- Mark a task `READY_TO_CODE` and confirm it does not auto-start
- Explicitly queue/start coding and confirm the worker begins only after that action
- Trigger a coding run that ends with partial progress or a dependency gap
- Submit follow-up feedback and confirm the task can iterate coding
- Confirm the next coding run references the same plan/current repo state
- Inspect the task detail page and confirm changed files summary replaces the raw diff dump
- Run `pnpm build`

## Next Step
Next step: execute Phase 02 to make coding continuation prompts and runner behavior more iteration-aware, then proceed to review UX and diff summary work.
