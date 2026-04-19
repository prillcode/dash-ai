# SUMMARY 01-01 — Install Pi SDK & Remove OpenCode Dependencies

## Status: ✅ Completed

## Changes
- Removed `@opencode-ai/sdk` from `packages/server/package.json`
- Added `@mariozechner/pi-coding-agent` (0.67.68), `@mariozechner/pi-ai` (0.67.68), `@sinclair/typebox` (0.34.49)
- Deleted `packages/server/src/agent/authCheck.ts` (read `~/.local/share/opencode/auth.json`)
- Created `packages/server/src/agent/piSession.ts` with shared Pi SDK helpers:
  - `getAuth()` — singleton `AuthStorage.create()`
  - `getModelRegistry()` — singleton `ModelRegistry.create(auth)`
  - `checkProviderAuth(providerID)` — validates credentials via Pi's model registry
  - `resolveModel(provider, modelId)` — looks up model, throws if not found
- Updated `packages/server/src/routes/auth.ts` to import from `piSession`
- Updated `packages/server/src/env.ts` to add `~/.pi/bin` to PATH instead of `~/.opencode/bin`

## Verification
- `pnpm build` passes with zero TS errors
- No remaining imports from `@opencode-ai/sdk`
- No remaining references to `authCheck.ts`
