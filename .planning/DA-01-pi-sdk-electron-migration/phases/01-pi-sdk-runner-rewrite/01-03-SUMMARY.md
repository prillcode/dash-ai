# SUMMARY 01-03 — Rewrite codingRunner.ts with Pi SDK + start-work-run Skill

## Status: ✅ Completed

## Changes
- Complete rewrite of `packages/server/src/agent/codingRunner.ts`
- Removed all `gnome-terminal` spawning, temp shell scripts, process polling, heartbeat intervals
- Removed `normalizeModel` import and flat prompt construction
- New implementation:
  - Creates Pi `AgentSession` with `createCodingTools(repoPath)` for full source modification
  - Uses `DefaultResourceLoader` with persona's `systemPrompt`
  - Sends `/skill:start-work-run` with plan path for structured phased execution
  - Forwards Pi events (text_delta, tool_start/end, turn_start/end, agent_end) to Dash AI event system
  - 20-minute timeout via `session.abort()`
  - `captureGitDiff()` helper extracted — runs `git diff HEAD` after session completion
  - Session logging preserved via `logEvent()` helper
  - Returns `session.sessionId` from Pi SDK (not just taskId)

## Verification
- `pnpm build` passes
- No `spawn`, `gnome-terminal`, or `opencode-cli` references remain
- Coding session invokes `/skill:start-work-run` with plan path
- `git diff HEAD` still captured after session completion
