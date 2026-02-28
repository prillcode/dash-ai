# Phase 03 Plan 01: Persona Provider/Model + Type Presets — Summary

**Added provider/model awareness and persona type presets to personas: cascading provider→model dropdowns, a user-editable models.json config, and a Type selector that auto-fills tools/model for Planner, Coder, and Reviewer personas.**

## Accomplishments
- Added `provider` column to personas table (default 'anthropic') — migration applied
- Added `personaType` column to personas table (default 'custom') — migration applied
- `~/.ai-dashboard/models.json` auto-created on server start with Anthropic, OpenAI, Ollama presets
- `GET /api/models` public route serves the config (no auth required)
- `PersonaForm` now has:
  - Type dropdown at top (Planner / Coder / Reviewer / Custom) — selecting auto-fills provider, model, allowedTools, and description
  - Cascading Provider → Model dropdowns populated from `/api/models`
  - Allowed Tools field is now a controlled input that reflects the current array value (pre-filled by type preset, still user-editable)
- `PERSONA_PRESETS` constant in `types/persona.ts` defines defaults per type:
  - Planner: `read, write, edit, glob, grep` + `claude-opus-4-5`
  - Coder: `bash, read, write, edit, glob, grep` + `claude-sonnet-4-5`
  - Reviewer: `read, glob, grep` + `claude-sonnet-4-5`
- Full monorepo build passes clean

## Files Created/Modified
- `packages/server/src/db/schema.ts` — added `PersonaType` const, `personaType` column to personas
- `packages/server/src/db/migrations/0000_thin_triathlon.sql` — added `persona_type` column
- `packages/server/src/db/migrations/meta/0000_snapshot.json` — updated snapshot
- `packages/server/src/services/personaService.ts` — added `personaType` to interfaces + insert
- `packages/server/src/db/client.ts` — auto-creates `~/.ai-dashboard/models.json` on startup
- `packages/server/src/routes/models.ts` — **created** `GET /` serving models config
- `packages/server/src/index.ts` — registered `/api/models` route before auth middleware
- `packages/client/src/types/persona.ts` — added `PersonaType`, `PERSONA_PRESETS`, `personaType` field on interfaces
- `packages/client/src/api/personas.ts` — added `useModels()` hook
- `packages/client/src/components/personas/PersonaForm.tsx` — Type dropdown + cascading provider/model + controlled allowedTools input

## Decisions Made
- `PERSONA_PRESETS` lives client-side only (no server endpoint needed — not user-editable config, just UI defaults)
- Allowed Tools renders as a controlled `<input>` (not via `register`'s `setValueAs`) so preset values from `setValue()` are immediately reflected in the displayed text
- Type selection pre-fills description only if the field is currently empty (doesn't clobber existing descriptions on edit)
- Planner preset intentionally excludes `bash` — planning agents should have no shell access

## Issues Encountered
- `FormField` doesn't support a `defaultValue` prop — fixed by rendering Allowed Tools as a controlled `<input>` using `watch("allowedTools")` + `setValue`

## Next Step
Ready for 03-02-PLAN.md (Projects schema + service + routes).
