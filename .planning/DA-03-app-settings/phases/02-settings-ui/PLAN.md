# DA-03 Phase 02 — Settings UI Plan

## Objective
Create a React Settings page at `/settings` where users can view and modify all application defaults. The form should use cascading dropdowns for provider/model selection and persist changes via the API.

## Context
Phase 01 created the backend infrastructure:
- `GET /api/settings` — returns current defaults
- `PATCH /api/settings` — updates defaults with validation
- 8 settings supported: provider, model, personas, project, autoStartPlanning, uiTheme, confirmDestructiveActions

The UI should be intuitive, use existing patterns from the codebase, and reuse components like the cascading provider/model dropdowns from PersonaForm.

## Current State
- No Settings page exists
- No settings API hooks exist on client
- PersonaForm has cascading provider/model dropdowns we can reference
- Navigation sidebar needs a Settings link

## Tasks

### Task 1: Create settings API hooks
**File:** `packages/client/src/api/settings.ts`

Create TanStack Query hooks:
- `useSettings()` — fetch settings (GET /api/settings)
- `useUpdateSettings()` — mutation to update settings (PATCH /api/settings)

Both should handle loading/error states properly.

**Verification:**
- Hooks compile without errors
- TypeScript types match `DefaultSettings` from server

### Task 2: Create SettingsPage component
**File:** `packages/client/src/pages/SettingsPage.tsx`

Create a form with all 8 settings:

**Section 1: AI Provider Defaults**
- Default Provider (dropdown, filtered to configured providers)
- Default Model (dropdown, updates when provider changes)

**Section 2: Default Personas**
- Default Planner Persona (dropdown, lists all active planner personas)
- Default Coder Persona (dropdown, lists all active coder personas)

**Section 3: Project Defaults**
- Default Project (dropdown, lists all active projects)

**Section 4: Workflow**
- Auto-start Planning (toggle/checkbox)

**Section 5: UI Preferences**
- UI Theme (dropdown: dark / light / system)
- Confirm Destructive Actions (toggle/checkbox)

**Actions:**
- Save button (primary)
- Reset to defaults button (secondary, optional)
- Cancel button (navigate back)

**Form Behavior:**
- Load current settings on mount
- Track dirty state (enable Save only when changed)
- Show loading spinner while saving
- Show success toast on save
- Show error message on failure

**Verification:**
- Component renders without errors
- All form fields populate with current settings
- Provider/model dropdowns cascade correctly

### Task 3: Add Settings route
**File:** `packages/client/src/App.tsx`

- Import SettingsPage
- Add route: `/settings` → SettingsPage
- Ensure route is protected (requires auth)

**Verification:**
- Route works: http://localhost:5173/settings
- Direct navigation works
- Auth protected

### Task 4: Add Settings navigation link
**File:** Check existing navigation component (likely in `src/components/layout/` or `src/App.tsx`)

Add a "Settings" link/button in the main navigation sidebar/header.

**Verification:**
- Link visible in navigation
- Clicking navigates to /settings
- Active state shown when on settings page

### Task 5: Update PersonaForm to use defaults
**File:** `packages/client/src/components/personas/PersonaForm.tsx`

When creating a NEW persona:
- Fetch settings via `useSettings()`
- Pre-select `defaultProvider` and `defaultModel` if set
- If no defaults, fall back to first available provider

**Verification:**
- Creating new persona pre-fills provider/model from settings
- Editing existing persona ignores defaults (keeps current values)

## Verification Steps

1. **Build passes:**
   ```bash
   cd packages/client && pnpm build
   # No TypeScript errors
   ```

2. **Settings page loads:**
   - Navigate to http://localhost:5173/settings
   - All 8 settings visible and populated

3. **Provider/Model cascade works:**
   - Change provider → model dropdown updates
   - Only configured providers shown

4. **Save persists:**
   - Change a setting
   - Click Save
   - Refresh page → changes still there
   - Verify in database: `sqlite3 ~/.dash-ai/dashboard.db "SELECT * FROM settings;"`

5. **PersonaForm integration:**
   - Create new persona → provider/model pre-selected from defaults

6. **Error handling:**
   - Disconnect server → shows error message
   - Invalid provider (edge case) → handled gracefully

## Done Conditions

- [ ] `useSettings()` and `useUpdateSettings()` hooks exist
- [ ] SettingsPage component with all 8 settings
- [ ] Provider/model cascading dropdowns work
- [ ] Save button persists to API
- [ ] Success/error feedback shown
- [ ] Route `/settings` accessible
- [ ] Navigation link to Settings visible
- [ ] PersonaForm uses defaults for new personas
- [ ] All builds pass
- [ ] Manual testing complete

## Next Step

After this plan is complete, use `/skill:start-work-run` to execute Phase 03 (Integration with other forms like Task creation).
