> **📋 Planning Instructions**
> When using `/skill:start-work-plan` for this work:
> - Create detailed phase plans in the `phases/` subdirectory
> - Reference this BRIEF.md for work context and scope
> - **Identifier:** `DA-06`
> - **Commits:**
>   - Subagent: Use `feat(da-06-01):`, `feat(da-06-02):`, etc.
>   - Manual: Use standard prefixes without identifier

---

# Work: Coding Runner Hardening

**Identifier:** DA-06  
**Type:** Enhancement

## Objective
Harden Dash AI’s coding workflow so coding starts only when an executable plan actually exists, cancellation behaves like real cancellation, no-op runs are surfaced clearly instead of looking successful, and coding session targeting/telemetry are more deterministic and inspectable.

## Relevant Files
- [packages/server/src/agent/codingRunner.ts](packages/server/src/agent/codingRunner.ts) - coding session orchestration, execution doc selection, diff handling
- [packages/server/src/services/queueWorker.ts](packages/server/src/services/queueWorker.ts) - task claiming, RUNNING lifecycle, session completion handling
- [packages/server/src/routes/tasks.ts](packages/server/src/routes/tasks.ts) - task status transitions, start/ready-to-code validation, cancel/retry endpoints
- [packages/server/src/services/taskService.ts](packages/server/src/services/taskService.ts) - task persistence, plan validation helpers, status updates
- [packages/server/src/services/eventService.ts](packages/server/src/services/eventService.ts) - coding event persistence/broadcast
- [packages/client/src/components/tasks/TaskActionBar.tsx](packages/client/src/components/tasks/TaskActionBar.tsx) - Start Coding / Skip Planning / Cancel UX
- [packages/client/src/components/tasks/PlanningSection.tsx](packages/client/src/components/tasks/PlanningSection.tsx) - Ready-to-code UX affordances
- [packages/client/src/pages/TaskDetailPage.tsx](packages/client/src/pages/TaskDetailPage.tsx) - task diagnostics visibility
- [packages/client/src/components/timeline/TaskTimelinePanel.tsx](packages/client/src/components/timeline/TaskTimelinePanel.tsx) - coding session event rendering

## Scope
**Included:**
- Prevent `READY_TO_CODE` / coding starts when no executable `PLAN.md` or `EXECUTION.md` exists
- Fix or disable misleading “Skip Planning & Start Coding” flows when no plan exists
- Add real cancellation/abort behavior for active coding sessions
- Treat empty-diff / no-op coding runs explicitly instead of silently succeeding into review
- Persist coding session metadata earlier and more clearly
- Tighten coding runner guardrails around unrelated `.planning/*` artifacts without blocking legitimate repo work
- Improve coding diagnostics so selected execution docs and outcomes are visible to users

**Excluded:**
- Full workflow/state-machine redesign beyond the minimum needed for safer coding runs
- Replacing Pi skills or the coding runner with a different architecture
- Broad review UX redesign unrelated to coding lifecycle clarity
- Destructive DB resets or schema wipes

## Context
**Observed current state:**
- `codingRunner.ts` now selects a concrete execution doc more reliably than before.
- The UI still exposes paths that can push tasks into coding without a valid executable plan.
- “Cancel” appears to update task state but does not look wired to abort an in-flight coding session.
- A coding run with an empty diff can still look successful and move toward review.
- Session targeting is improved, but some metadata still only exists in event logs instead of task state.

## Proposed Approach
1. Validate plan readiness before allowing a task to enter coding states.
2. Add real cancellation for active coding sessions via in-memory session tracking and abort wiring.
3. Distinguish successful implementation from no-op/empty-diff sessions.
4. Persist early coding metadata (session id, selected execution doc) and improve diagnostics.
5. Add narrow `.planning` guardrails so coding stays within the intended work item’s planning artifacts while still allowing broad code changes elsewhere in the repo.

## Success Criteria
- [ ] Tasks cannot enter coding flow without a valid executable plan artifact
- [ ] “Skip Planning & Start Coding” no longer misleads users when no plan exists
- [ ] Canceling an active coding task actually aborts the live session
- [ ] Empty-diff coding runs are surfaced clearly and do not masquerade as successful review-ready work
- [ ] Coding session id and selected execution doc are visible early enough for debugging
- [ ] Coding does not read/write unrelated `.planning/*` work items by default
- [ ] `pnpm build` succeeds after the hardening changes
- [ ] Manual verification confirms coding flow is safer and easier to inspect

## Risks
- Tightening coding entry validation may expose existing UI assumptions that were previously hidden
- Real cancellation requires careful in-memory session tracking to avoid leaks or stale handles
- Treating empty diffs as failure/no-op may change expectations for some manual workflows
- Over-constraining `.planning` access could break legitimate implementation behavior if done too broadly

## Open Questions
1. Should no-op coding runs become `FAILED`, a new explicit status, or remain reviewable with a warning?
2. Should “Skip Planning” be removed entirely, or allowed only when an explicit lightweight execution doc exists?
3. Should selected execution doc be persisted on the task row, in events only, or both?
4. Should cancel/reset behavior differ for `QUEUED` vs `RUNNING` tasks?
5. Do we want a distinct “canceled” or “aborted” task status in the future?

## Follow-on Work
- Coding iteration / rework workflow and review UX are intentionally split into **DA-07** so DA-06 can stay focused on runner safety and lifecycle correctness.
- DA-07 should cover:
  - iterating coding tasks with user feedback
  - better partial-progress / blocked-work states
  - improving or replacing the current raw diff preview panel
