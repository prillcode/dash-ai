# DA-03 — App Settings — ROADMAP

## Phase 01 — Database & API

**Objective:** Create settings infrastructure (DB table + API endpoints)

**Outputs:**
- [ ] Database migration: `settings` table (key-value: `id`, `key`, `value`, `updatedAt`)
- [ ] `packages/server/src/db/schema.ts` — add settings table
- [ ] `packages/server/src/services/settingsService.ts` — CRUD operations
- [ ] `packages/server/src/routes/settings.ts` — `GET /api/settings`, `PATCH /api/settings`
- [ ] Wire up routes in `app.ts`

## Phase 02 — Settings UI

**Objective:** Create Settings page with provider/model selection

**Outputs:**
- [ ] `packages/client/src/pages/SettingsPage.tsx` — settings form
- [ ] Provider dropdown (filtered to configured providers via `useModels()`)
- [ ] Model dropdown (cascading based on provider)
- [ ] Save/Cancel buttons
- [ ] Navigation link to Settings page
- [ ] Route in `App.tsx`

## Phase 03 — Integration

**Objective:** Use defaults in PersonaForm

**Outputs:**
- [ ] `packages/client/src/api/settings.ts` — `useSettings()` hook
- [ ] Update `PersonaForm.tsx` — pre-select defaults when creating new persona
- [ ] Handle case where no defaults set (fallback to first available)

## Phase 04 — Testing & Polish

**Objective:** Verify across all interfaces

**Outputs:**
- [ ] Test: Web UI settings persist
- [ ] Test: Electron app uses same settings
- [ ] Test: Defaults populate PersonaForm
- [ ] Add loading states
- [ ] Error handling for save failures

---

## Notes

- Keep settings schema simple (key-value) for extensibility
- Reuse existing `useModels()` hook for provider/model dropdowns
- Settings are global (not per-user) since this is single-user app
- Consider adding `createdAt` to settings table for audit
