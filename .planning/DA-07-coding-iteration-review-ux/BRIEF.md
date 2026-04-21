> **📋 Planning Instructions**
> When using `/skill:start-work-plan` for this work:
> - Create detailed phase plans in the `phases/` subdirectory
> - Reference this BRIEF.md for work context and scope
> - **Identifier:** `DA-07`
> - **Commits:**
>   - Subagent: Use `feat(da-07-01):`, `feat(da-07-02):`, etc.
>   - Manual: Use standard prefixes without identifier

---

# Work: Coding Iteration + Review UX

**Identifier:** DA-07  
**Type:** Enhancement

## Objective
Add a true coding-iteration workflow to Dash AI so users can respond to partial or blocked coding runs with follow-up instructions, and improve the post-coding review UX so it reflects real agent workflows better than the current binary approve/reject model and raw unified diff preview.

## Relevant Files
- [packages/server/src/routes/tasks.ts](packages/server/src/routes/tasks.ts) - task actions and coding iteration endpoints
- [packages/server/src/services/taskService.ts](packages/server/src/services/taskService.ts) - task status/feedback persistence and coding iteration helpers
- [packages/server/src/db/schema.ts](packages/server/src/db/schema.ts) - task state / feedback fields if new persistence is needed
- [packages/server/src/agent/codingRunner.ts](packages/server/src/agent/codingRunner.ts) - coding continuation prompt and partial-progress handling
- [packages/server/src/services/queueWorker.ts](packages/server/src/services/queueWorker.ts) - queue behavior for coding iterations
- [packages/client/src/components/tasks/TaskActionBar.tsx](packages/client/src/components/tasks/TaskActionBar.tsx) - task-level actions after coding runs
- [packages/client/src/components/tasks](packages/client/src/components/tasks) - candidate home for iteration form/components
- [packages/client/src/pages/TaskDetailPage.tsx](packages/client/src/pages/TaskDetailPage.tsx) - coding review and diagnostics layout
- [packages/client/src/components/diff](packages/client/src/components/diff) - current raw diff review UI to replace or simplify
- [packages/client/src/components/timeline/TaskTimelinePanel.tsx](packages/client/src/components/timeline/TaskTimelinePanel.tsx) - timeline messaging for partial/iterated coding runs

## Scope
**Included:**
- Add a coding-iteration action with user feedback input similar to plan iteration
- Support resuming or continuing coding after partial progress / dependency gap discovery
- Improve status semantics for partial, blocked, or changes-requested coding outcomes
- Replace or simplify the current raw `diff --git` preview panel with a more useful changed-files summary
- Show changed files with added/deleted counts and let users inspect diffs in their preferred IDE externally
- Ensure task actions and review language match the reality that repo changes may already exist before approval/rejection

**Excluded:**
- Full Git staging/unstaging management inside Dash AI
- IDE-integrated diff viewer
- Multi-user review workflows or permissions redesign
- Rewriting the entire task state machine unless a minimal extension is required

## Context
**Observed product gap:**
- Coding runs can make valid partial progress and discover blockers or dependency gaps.
- The current UI only offers `Approve` / `Reject`, which does not fit iterative agent coding well.
- Rejecting a task does not undo already-written repo changes, so the current wording is misleading.
- The raw unified diff panel is noisy and low-value for this workflow; a concise changed-file summary would be more useful.
- This work is intentionally separate from DA-06, which focuses on coding runner safety and lifecycle correctness.

## Proposed Approach
1. Add a coding iteration/rework flow that captures user feedback and re-queues the task for continued coding.
2. Introduce clearer post-coding actions/states for partial progress, requested changes, blocked work, or continue-with-feedback.
3. Update codingRunner prompts so iteration runs use prior context, current repo state, selected plan, and user feedback coherently.
4. Replace the current raw diff preview with a changed-files summary (file path + added/deleted counts), while still preserving underlying diff artifacts on disk if needed.
5. Keep the UX honest about the fact that code may already be in the repo before a task is “approved.”

## Success Criteria
- [ ] Users can iterate a coding task with freeform feedback after a partial/blocked run
- [ ] Coding iterations reuse the existing repo state and task context instead of starting blindly
- [ ] The post-coding action model is clearer than approve/reject alone
- [ ] The raw unified diff preview panel is removed or downgraded in favor of a concise changed-files summary
- [ ] Changed files display includes add/delete counts per file
- [ ] Timeline/task detail messaging reflects partial progress and follow-up iterations clearly
- [ ] `pnpm build` succeeds after the changes

## Risks
- Adding new coding states can complicate queue behavior if not kept narrow
- Continuing coding on a dirty repo requires careful prompt framing to avoid duplicate edits
- Replacing the diff panel could reduce detail unless the summary still links conceptually to the stored diff artifact

## Open Questions
1. Should coding iteration return the task to `RUNNING` directly, or pass through a review/requested-changes state first?
2. Do we want a distinct `BLOCKED` state when the coder identifies an upstream dependency gap?
3. Should the changed-file summary be generated from the stored diff artifact or from fresh git inspection?
4. Should raw diff remain accessible behind an advanced toggle, or disappear entirely from the main task view?
5. How much prior coding output should be replayed into an iteration prompt versus relying on current repo state + user feedback?
