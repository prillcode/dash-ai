# SUMMARY 01-04 — Update queueWorker and Clean Up

## Status: ✅ Completed

## Changes
- Deleted `packages/server/src/agent/sessionRunner.ts` — unnecessary indirection removed
- Rewrote `packages/server/src/services/queueWorker.ts`:
  - Imports `runCodingSession` directly from `codingRunner` (no `sessionRunner` wrapper)
  - Default concurrent limit reduced from 3 to 2 (in-process Pi sessions are memory-heavy)
  - All task flow logic unchanged (planning → planned → running → awaiting_review)
- Rewrote `packages/server/src/index.ts`:
  - Replaced `checkSkillsInstalled()` with filesystem check for pi-native skills at `~/.agents/skills/`
  - Added Pi SDK initialization check (`getModelRegistry().getAvailable()`)
  - Checks for `start-work-begin`, `start-work-plan`, `start-work-run` skills
- Rewrote `packages/server/src/routes/auth.ts`:
  - Removed all `opencode` CLI references
  - OAuth refresh now spawns `pi login` instead of `opencode auth login`
- Updated `packages/server/src/env.ts`:
  - PATH manipulation targets `~/.pi/bin` instead of `~/.opencode/bin`
- Created `packages/server/.env.example` with Pi SDK env vars
- Deleted `packages/server/OpenCode-SDK-Integration.md` (obsolete)

## Verification
- `pnpm build` passes with zero TS errors
- `grep -r "opencode-cli\|gnome-terminal\|@opencode-ai" packages/server/src/` returns nothing
- `sessionRunner.ts` deleted
- Queue worker starts with Pi SDK initialization
- `MAX_CONCURRENT_SESSIONS` env var still respected (default: 2)
