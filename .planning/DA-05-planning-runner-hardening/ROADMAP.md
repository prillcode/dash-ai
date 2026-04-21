# Roadmap: Planning + Coding Runner Hardening

**Identifier:** DA-05

## Recommended Mode
Full planning scaffold.

Reasoning:
- This work spans runner behavior, prompt design, observability, and verification.
- Some recommendations are low-risk prompt tweaks, while others may affect task/session UX and runtime behavior.
- The changes should be implemented incrementally so regressions are easy to detect.

## Phases

### Phase 01: Planning Targeting Guardrails
**Status:** 📋 Planned

**Goals:**
- Make fresh planning deterministic about the intended work item
- Prevent normal planning runs from drifting into unrelated `.planning/*` work items
- Fail loudly when scaffold creation does not produce the expected target directory

**Expected outputs:**
- Stronger `planningRunner` prompt contract for fresh planning and iteration
- Matching-directory validation logic for fresh planning
- Explicit handling for allowed vs forbidden precedent reads
- Clear error message path when planning target creation fails

**Verification:**
- New test task with identifier creates the expected `.planning/<identifier>-...` directory
- Trace shows no unrelated `.planning/*` reads during normal planning
- Broken scaffold scenario returns failure instead of a reused `planPath`

---

### Phase 02: Planning Speed and Mode Right-Sizing
**Status:** 📋 Planned

**Goals:**
- Reduce average planning runtime for straightforward tasks
- Introduce a lightweight planning path where full phase expansion is unnecessary
- Tune planning model/thinking defaults without losing acceptable output quality

**Expected outputs:**
- Planning mode decision rules or explicit mode support
- Optional “fast plan” / “detailed plan” behavior
- Updated planning prompt/runner logic for smaller tasks
- Sensible default thinking/model configuration for planning personas or runner behavior

**Verification:**
- Straightforward planning tasks complete faster than current baseline
- Resulting plans remain usable and on-target
- Detailed mode still produces deeper planning when needed

---

### Phase 03: Session Telemetry and Event Noise Reduction
**Status:** 📋 Planned

**Goals:**
- Make long-running sessions easier to inspect and debug
- Reduce excessive text/event noise while keeping important breadcrumbs
- Surface selected work item / selected execution doc clearly in events

**Expected outputs:**
- Cleaner persisted/broadcast planning and coding events
- Session diagnostics for target work item, selected plan/execution doc, runtime, and turn counts
- Optional text chunking/coalescing or verbosity reduction

**Verification:**
- Event stream remains understandable during planning/coding runs
- Total event volume is lower or more meaningful for similar sessions
- Debugging still has enough detail to diagnose failures

---

### Phase 04: End-to-End Runner Verification and UX Follow-Through
**Status:** 📋 Planned

**Goals:**
- Re-validate planning, plan iteration, ready-for-code, and coding execution end-to-end
- Confirm `codingRunner` remains deterministic after the recent targeting improvements
- Add any minimal client/server affordances needed to make behavior understandable to the user

**Expected outputs:**
- Manual verification checklist/results
- Any final server/client adjustments needed for visibility or safety
- Build-passing runner hardening summary

**Verification:**
- Fresh planning works for a new task
- Plan iteration updates the existing work item in place
- Ready-for-code → coding selects the intended execution doc
- Diff/session artifacts align with the chosen plan
- `pnpm build` passes

## Likely Files To Change
- `packages/server/src/agent/planningRunner.ts`
- `packages/server/src/agent/codingRunner.ts`
- `packages/server/src/services/queueWorker.ts`
- `packages/server/src/services/eventService.ts`
- `packages/server/src/services/taskService.ts`
- `packages/server/src/routes/tasks.ts`
- `packages/client/src/components/tasks/PlanningSection.tsx` *(if UX follow-through is needed)*
- `packages/client/src/pages/TaskDetailPage.tsx` *(if UX follow-through is needed)*

## Lightweight Verification Checklist
- Create a new draft task with a unique identifier and start planning
- Confirm the resulting `planPath` matches the expected identifier/work name
- Confirm planning does not read unrelated `.planning/*` folders in the task event trace
- Retry/iterate a planned task and confirm it updates the same work item
- Mark a task ready for code and confirm the coder targets the expected execution doc
- Inspect emitted events for selected target details and acceptable verbosity
- Run `pnpm build`

## Next Step
Next step: use `/skill:start-work-plan` to expand Phase 01 into an executable implementation plan, then continue phase-by-phase.
