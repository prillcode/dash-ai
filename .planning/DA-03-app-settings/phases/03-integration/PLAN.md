# DA-03 Phase 03 — Settings Integration Plan

## Objective
Integrate the default settings into task creation and other workflows throughout the app. Pre-fill forms with user-configured defaults to reduce repetitive selections and enable workflow automation features.

## Context
Phase 02 created the Settings UI where users can configure:
- Default provider/model for AI
- Default planner/coder personas
- Default project
- Auto-start planning toggle
- UI preferences

These defaults need to be wired into the actual task creation flow and other relevant forms.

## Current State
- Settings API and UI are complete
- Task creation form exists at `/tasks/new` (TaskCreatePage)
- Task form uses manual selection for all fields
- No integration with settings defaults yet

## Scope

### In Scope (MVP)
- Task creation form pre-fills from settings
- Respect auto-start planning setting
- Quick-create task button from project page

### Out of Scope (Future)
- Auto-advance through planning states
- Batch task creation with defaults
- Per-project default overrides

## Tasks

### Task 1: Update TaskCreatePage with defaults
**File:** `packages/client/src/pages/TaskCreatePage.tsx`

Modify the task creation form to:
1. Fetch settings via `useSettings()`
2. Pre-fill form fields when component mounts:
   - `projectId` → `defaultProjectId`
   - `planningPersonaId` → `defaultPlannerPersonaId`
   - `codingPersonaId` → `defaultCoderPersonaId`
3. If `autoStartPlanning` is true:
   - Auto-check a "Start planning immediately" option (or just trigger after create)
   - Show visual indicator that auto-start is enabled

**Form behavior:**
- Only pre-fill if the setting exists (not empty)
- User can override any pre-filled value
- Show "Using defaults from settings" hint when values are pre-filled

**Verification:**
- Form loads with defaults populated
- User can change pre-filled values
- Form submits correctly with either defaults or overrides

### Task 2: Add auto-start planning logic
**File:** `packages/client/src/pages/TaskCreatePage.tsx`

When task is created successfully:
1. Check if `autoStartPlanning` setting is true
2. If yes, automatically call `start-planning` endpoint
3. Navigate to task detail page (which will show planning in progress)
4. If auto-start fails, show warning but don't block (task is still created)

**UI for auto-start:**
- Show checkbox "Start planning immediately" 
- Default state comes from settings
- User can override per-task

**Verification:**
- Task created with auto-start=true → planning starts automatically
- Task created with auto-start=false → stays in DRAFT state
- Navigation happens correctly in both cases

### Task 3: Quick-create from Project page
**File:** `packages/client/src/pages/ProjectDetailPage.tsx`

Add a "Quick Create Task" button on the project page:
1. Pre-fills the project field (current project)
2. Uses other defaults from settings (personas, etc.)
3. Opens task creation form or modal

Alternative: Navigate to `/tasks/new?projectId=xxx` with query param.

**Verification:**
- Button visible on project page
- Clicking navigates to task creation with project pre-selected

### Task 4: Settings-aware empty states
**Files:** Various list pages

Update empty states to mention settings:
- PersonaList: "Set default personas in Settings"
- ProjectList: "Set default project in Settings"

**Verification:**
- Empty states have helpful links or hints

## Verification Steps

1. **Settings configured:**
   ```bash
   # Set some defaults
   curl -X PATCH http://localhost:3000/api/settings \
     -H "Authorization: Bearer $TOKEN" \
     -d '{"defaultProjectId":"proj-1","defaultPlannerPersonaId":"plan-1","autoStartPlanning":true}'
   ```

2. **Task creation uses defaults:**
   - Navigate to `/tasks/new`
   - Verify project and personas are pre-selected
   - Verify "Start planning immediately" is checked (from autoStartPlanning)

3. **Auto-start works:**
   - Create task with auto-start enabled
   - Verify task goes to IN_PLANNING state automatically
   - Navigate shows planning in progress

4. **Override works:**
   - Change pre-filled values in form
   - Submit task
   - Verify custom values are used (not defaults)

5. **Quick-create from project:**
   - Go to project detail page
   - Click "Quick Create Task"
   - Verify form opens with project pre-selected

## Done Conditions

- [ ] TaskCreatePage pre-fills project, personas from settings
- [ ] Auto-start planning works when setting is enabled
- [ ] User can override defaults per-task
- [ ] Quick-create button on Project page
- [ ] Settings-aware empty states
- [ ] All builds pass
- [ ] Manual testing complete

## Next Step

After this plan is complete, use `/skill:start-work-run` to execute Phase 04 (Testing & Polish) or move on to DA-04 (Agent.md Generation).
