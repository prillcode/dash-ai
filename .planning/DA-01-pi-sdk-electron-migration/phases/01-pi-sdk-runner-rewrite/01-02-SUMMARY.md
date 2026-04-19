# SUMMARY 01-02 — Rewrite planningRunner.ts with Pi SDK + Pi-Native Skills

## Status: ✅ Completed

## Changes
- Complete rewrite of `packages/server/src/agent/planningRunner.ts`
- Removed all `gnome-terminal` spawning, temp shell scripts, process polling, heartbeat intervals
- Removed `normalizeModel()`, `checkSkillsInstalled()`, `buildPlanningPrompt()` functions
- New implementation:
  - Creates Pi `AgentSession` with `createReadOnlyTools(repoPath)` for read-only planning
  - Uses `DefaultResourceLoader` with persona's `systemPrompt`
  - Fresh planning: sends `/skill:start-work-begin` then `/skill:start-work-plan`
  - Plan iteration: sends `/skill:start-work-plan` with feedback (no re-scaffolding)
  - Forwards Pi events (text_delta, tool_start/end, turn_start/end, agent_end) to Dash AI event system
  - 20-minute timeout via `session.abort()`
  - `findLatestPlanDir()` helper retained for locating generated plan docs
- Added `planFeedback` field to `PlanningRunnerInput` for iteration support

## Verification
- `pnpm build` passes
- No `spawn`, `gnome-terminal`, or `opencode-cli` references remain
- Planning session invokes `/skill:start-work-begin` + `/skill:start-work-plan`
