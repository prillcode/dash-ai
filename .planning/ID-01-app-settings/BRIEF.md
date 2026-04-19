# ID-01 — App Settings (Default Provider/Model)

## Objective

Add an application-level Settings view where users can configure defaults that streamline common workflows:
- Default LLM provider (e.g., "anthropic", "openai")
- Default model for that provider
- Future: Default personas, theme, auto-approve preferences

These defaults pre-populate the Persona creation form, reducing repetitive selections.

## Background

Currently, creating a new Persona requires manually selecting a Provider and Model from dropdowns. Users typically use the same provider/model for most personas. A default setting eliminates this friction.

Settings will be stored in the SQLite database (key-value table) so they're shared across Web, CLI, and Electron interfaces.

## Scope

### In Scope (MVP)
- Database migration: `settings` table (key-value store)
- API endpoints: `GET /api/settings`, `PATCH /api/settings`
- React component: Settings page at `/settings`
- Form fields: Default Provider, Default Model (cascading dropdown)
- Integration: Pre-populate PersonaForm with defaults when creating new persona

### Out of Scope (Future)
- Default Planner/Coder personas for task creation
- Theme selection (dark/light mode)
- Auto-approve plans toggle
- Import/export settings

## Relevant Files

- `packages/server/src/db/schema.ts` — add settings table
- `packages/server/src/routes/settings.ts` — new API routes
- `packages/client/src/pages/SettingsPage.tsx` — new settings UI
- `packages/client/src/components/personas/PersonaForm.tsx` — use defaults
- `packages/client/src/App.tsx` — add settings route

## Acceptance Criteria

- [ ] Settings table exists with key-value schema
- [ ] Settings page accessible from navigation
- [ ] Provider dropdown shows only configured providers (from Pi SDK)
- [ ] Model dropdown updates when provider changes
- [ ] Saving settings persists to database
- [ ] Creating new persona pre-selects default provider/model
- [ ] Defaults work across Web, CLI, and Electron
