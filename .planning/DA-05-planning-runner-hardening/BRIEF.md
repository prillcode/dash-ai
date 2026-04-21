> **📋 Planning Instructions**
> When using `/skill:start-work-plan` for this work:
> - Create detailed phase plans in the `phases/` subdirectory
> - Reference this BRIEF.md for work context and scope
> - **Identifier:** `DA-05`
> - **Commits:**
>   - Subagent: Use `feat(da-05-01):`, `feat(da-05-02):`, etc.
>   - Manual: Use standard prefixes without identifier

---

# Work: Planning + Coding Runner Hardening

**Identifier:** DA-05  
**Type:** Enhancement

## Objective
Harden Dash AI's planning and coding runners so planning is more deterministic, faster, and less likely to inspect unrelated `.planning/` work items, while preserving the recent fixes that correctly create and target a new work item directory. Add clear guardrails, better failure behavior, lighter-weight planning options, and better telemetry so the task lifecycle is trustworthy during real-world use.

## Relevant Files
- [packages/server/src/agent/planningRunner.ts](packages/server/src/agent/planningRunner.ts) - Planning orchestration, skill prompts, target directory detection
- [packages/server/src/agent/codingRunner.ts](packages/server/src/agent/codingRunner.ts) - Coding orchestration, execution doc targeting, prompt shaping
- [packages/server/src/services/queueWorker.ts](packages/server/src/services/queueWorker.ts) - Task claiming and session lifecycle
- [packages/server/src/services/taskService.ts](packages/server/src/services/taskService.ts) - Task status updates, plan path persistence, validation helpers
- [packages/server/src/services/eventService.ts](packages/server/src/services/eventService.ts) - Event persistence and broadcast behavior
- [packages/server/src/routes/tasks.ts](packages/server/src/routes/tasks.ts) - User-triggered planning/coding transitions and task APIs
- [packages/server/src/services/personaService.ts](packages/server/src/services/personaService.ts) - Persona model/system prompt lookup
- [packages/client/src/pages/TaskDetailPage.tsx](packages/client/src/pages/TaskDetailPage.tsx) - Candidate UI surface for better session visibility if needed
- [packages/client/src/components/tasks/PlanningSection.tsx](packages/client/src/components/tasks/PlanningSection.tsx) - Candidate UI surface for planning status improvements if needed

## Scope
**Included:**
- Strengthen planning prompts so fresh planning stays inside the intended target work item
- Add explicit failure behavior when a matching planning directory is not created
- Reduce planner over-exploration of unrelated `.planning/*` work items by default
- Introduce clearer planning modes / lightweight planning paths where appropriate
- Evaluate and tune model/thinking defaults for planning speed
- Reduce noisy planning/coding event output where it hurts UX or debugging signal
- Improve observability around selected work item, selected execution doc, turn counts, and runtime budgets
- Re-verify coding runner behavior so it does not regress into similar targeting ambiguity
- Preserve existing correct behavior where planning persona system prompts are passed through

**Excluded:**
- Full redesign of the task state machine
- Replacing Pi skills with a completely custom planning framework
- Broad client UX redesign unrelated to task/session diagnostics
- Multi-user permissions / auth redesign
- Database resets or destructive migration changes

## Context
**Observed current state:**
- The original planning bug was fixed: planning can now create a new `.planning/<identifier>-...` work item and persist the correct `planPath`.
- Planning remains somewhat slow (~4–5 minutes in recent testing) because the model still explores broadly before writing files.
- Recent traces show planning may read adjacent historical work items (for example, a related `mdo-642` plan) even when it eventually writes the correct new work item.
- `codingRunner.ts` has already been improved to resolve a concrete execution target instead of handing the model an ambiguous work item directory only.
- The repo currently has local modifications in `packages/server/src/agent/planningRunner.ts` and `packages/server/src/agent/codingRunner.ts`; this work should build on those changes, not overwrite them accidentally.

## Proposed Approach
1. Lock planning sessions to an explicit target work item and forbid unrelated `.planning/*` reads unless the prompt explicitly allows precedent research.
2. Add fast-fail checks so fresh planning errors clearly if `start-work-begin` did not create the expected directory.
3. Right-size planning effort with configurable planning modes, thinking/model defaults, and lightweight scaffolds where deep phase planning is unnecessary.
4. Reduce event/text noise and add concise diagnostics that make long sessions easier to interpret.
5. Verify the full flow with targeted tests/manual checks for planning, iteration, ready-for-code transitions, and coding execution targeting.

## Success Criteria
- [ ] Fresh planning reliably creates and stores the intended `.planning/<identifier>-...` directory for new tasks
- [ ] Planner no longer reads unrelated `.planning/*` work items by default during normal planning
- [ ] Fresh planning fails clearly when a matching directory is not created instead of silently reusing another work item
- [ ] Planning can run in a lighter/faster mode for straightforward tasks
- [ ] Planner/coder session diagnostics clearly show selected work item and selected execution doc
- [ ] Event volume is reduced or made more digestible without losing debugging value
- [ ] `pnpm build` succeeds after the hardening changes
- [ ] Manual verification confirms planning, iteration, and coding still work end-to-end

## Risks
- Over-constraining the planner may make some legitimate repo exploration impossible
- Reducing planning effort too aggressively could degrade plan quality for ambiguous work
- Event coalescing could remove useful debugging breadcrumbs if done without care
- Changing planning modes may require small UI/API affordance updates to keep behavior understandable

## Open Questions
1. Should “unrelated `.planning` reads” be prohibited entirely by default, or only allowed when a persona or task explicitly requests precedent research?
2. Should planning mode be inferred automatically from task complexity, or selected explicitly by the user/UI?
3. Should event coalescing happen server-side before DB persistence, client-side at render time, or both?
4. Do we want separate default personas/models for “fast plan” vs “deep plan”?
5. Should planning and coding runtimes have configurable budgets/limits exposed in settings?
