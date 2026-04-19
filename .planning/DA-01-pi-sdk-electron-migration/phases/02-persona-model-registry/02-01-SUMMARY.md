# SUMMARY 02-01 — Rewrite Models Endpoint with Pi ModelRegistry

## Status: ✅ Completed

## Changes
- Complete rewrite of `packages/server/src/routes/models.ts`
- Removed `DEFAULT_MODELS` constant and `~/.dash-ai/models.json` file read
- `GET /api/models` now uses Pi's `ModelRegistry`:
  - `registry.getAll()` for all registered models
  - `registry.getAvailable()` for models with valid credentials (API key/OAuth)
  - `auth.hasAuth(provider)` for per-provider auth status
- Response includes:
  - `providers[]`: models grouped by provider, each with `id`, `name`, `reasoning`, `contextWindow`, `maxTokens`, `input`, `available`, `cost`
  - `authMethods{}`: per-provider auth type (`configured` or `env_var`) and `configured: bool`
- Providers sorted: known providers first (anthropic, openai, deepseek...), then alphabetical
- Known provider display names (e.g. "Z.AI", "Ollama (local)")

## Verification
- `GET /api/models` returns models from Pi's `ModelRegistry` ✅
- Response includes `available: true/false` per model based on API key presence ✅
- Response includes auth method info per provider ✅
- No dependency on `~/.dash-ai/models.json` ✅
- `pnpm build` passes ✅
