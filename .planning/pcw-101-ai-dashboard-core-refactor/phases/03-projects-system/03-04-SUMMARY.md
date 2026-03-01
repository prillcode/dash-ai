# Phase 03 Plan 04: Projects UI + Routing — Summary

**Completed the Projects UI with `ProjectListPage`, `ProjectFormPage`, Sidebar link, and routing; full end‑to‑end flow verified in browser.**

## Accomplishments
- Created `ProjectListPage` (`/projects`) showing all projects with create/edit/delete actions, loading/empty states, and delete confirmation.
- Created `ProjectFormPage` (`/projects/new`, `/projects/:id/edit`) with live path validation using `useValidatePath`, showing inline feedback (checking…, resolved path, error).
- Created `ProjectForm` component with proper Zod schema, form hooks, and validation‑aware submit button.
- Added “Projects” nav link to Sidebar (folder icon) between Personas and Monitor placeholder.
- Wired three new routes in `App.tsx`: `/projects`, `/projects/new`, `/projects/:id/edit`.
- Fixed TypeScript errors:
  - Removed nonexistent `as` prop from `FormField` (use `type="textarea"`).
  - Simplified `useProject` hook signature (removed `UseQueryOptions` overload).
  - Removed unused `Project` import and invalid `size` prop from `Button`.
- Created planner system‑prompt backup `.planning/planner‑system‑prompt.md` (clean markdown, no emojis).
- Full monorepo build passes (`pnpm build` exits 0) with zero TypeScript errors.

## Files Created/Modified
- **Created**:
  - `packages/client/src/pages/ProjectListPage.tsx`
  - `packages/client/src/pages/ProjectFormPage.tsx`
  - `packages/client/src/components/projects/ProjectForm.tsx`
  - `.planning/planner‑system‑prompt.md`
- **Modified**:
  - `packages/client/src/pages/index.ts` – added exports for `ProjectListPage`, `ProjectFormPage`
  - `packages/client/src/components/projects/index.ts` – added `ProjectForm` export
  - `packages/client/src/layouts/Sidebar.tsx` – added “Projects” nav item
  - `packages/client/src/App.tsx` – added three project routes
  - `packages/client/src/api/projects.ts` – simplified `useProject` signature
  - `packages/client/src/components/projects/ProjectForm.tsx` – fixed FormField usage

## Decisions Made
- Path validation is live‑as‑you‑type: shows “Checking path…”, green resolved path, or red error.
- Submit button disabled while path is invalid or validating (prevents bad data).
- Edit page uses `useProject(id, isEdit)` with enabled flag to skip fetch when `id` is empty.
- Sidebar uses simple folder icon (📁) matching existing icon style (emoji).

## Issues Encountered
- **TypeScript errors** – caught during build; fixed each by aligning with existing component APIs.
- **No personas after DB wipe** – user noted they cannot save a task because personas are missing (expected; can be re‑created manually).

## Next Step
Phase 03 complete. Ready for Phase 04: Planning Workflow Integration (04‑01‑PLAN.md).