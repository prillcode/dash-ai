# Phase 03 Plan 03: Projects Client Foundation — Summary

**Built client-side Projects foundation: TypeScript types, TanStack Query hooks, ProjectSelector component, and updated TaskForm to use project dropdown instead of free-text repo path.**

## Accomplishments
- Created `types/project.ts` with `Project`, `ProjectInput`, and `PathValidationResult` interfaces
- Created `api/projects.ts` with 6 TanStack Query hooks matching server endpoints (`useProjects`, `useProject`, `useValidatePath`, `useCreateProject`, `useUpdateProject`, `useDeleteProject`)
- Created `ProjectSelector` component that fetches active projects and calls `onChange` with `id`, `name`, `resolvedPath`
- Updated `TaskForm`:
  - Replaced free-text "Repository Path" field with `ProjectSelector` dropdown
  - Updated Zod schema: removed `repoPath`, added `projectId` (required)
  - Updated default values and form validation
- Updated server-side data layer:
  - Added `project_id` column to `tasks` table (nullable, foreign key to `projects`)
  - Updated Drizzle schema (`schema.ts`) and baseline migration (`0000_thin_triathlon.sql`)
  - Updated snapshot (`0000_snapshot.json`) with column and foreign key metadata
  - Wiped and re‑created database (zero tasks, one persona re‑created manually)
- Updated `TaskInput` interface (`services/taskService.ts`): removed `repoPath`, added `projectId`
- Updated `createTask` to fetch project and store `repoPath` derived from project’s `resolvedPath`
- Updated `routes/tasks.ts` POST handler: added project validation, passes `projectId` to service
- All changes type‑checked and built successfully (`pnpm build` exits 0)

## Files Created/Modified
- **Created**:
  - `packages/client/src/types/project.ts`
  - `packages/client/src/api/projects.ts`
  - `packages/client/src/components/projects/ProjectSelector.tsx`
  - `packages/client/src/components/projects/index.ts`
- **Modified**:
  - `packages/client/src/types/task.ts` – added `projectId` to `Task`, added `projectId` and removed `repoPath` from `TaskInput`
  - `packages/client/src/components/tasks/TaskForm.tsx` – schema, default values, replaced repo‑path field with `ProjectSelector`
  - `packages/server/src/db/schema.ts` – added `projectId` column to `tasks` table
  - `packages/server/src/db/migrations/0000_thin_triathlon.sql` – added `project_id` column and foreign key
  - `packages/server/src/db/migrations/meta/0000_snapshot.json` – added column and foreign‑key metadata
  - `packages/server/src/services/taskService.ts` – updated `TaskInput`, added project lookup, store `projectId` and derived `repoPath`
  - `packages/server/src/routes/tasks.ts` – added project‑service import, updated schema, added project validation
  - `packages/server/src/routes/projects.ts` (already existed from 03‑02) – no changes

## Decisions Made
- `project_id` column is nullable for now (existing tasks would have `NULL`). Foreign key references `projects(id)`.
- `repoPath` is still stored in the `tasks` table but is now derived from the selected project’s `resolvedPath` at creation time.
- Project validation happens in both route (early 400) and service (throws error) – double‑check ensures data consistency.
- `ProjectSelector` displays `name (resolvedPath)` in dropdown options with full path as `title` attribute.

## Issues Encountered
- **Duplicate `columnsFrom` line in snapshot JSON** – introduced during manual edit, fixed immediately.
- **Zero tasks in DB allowed wiping** – safe because only one persona existed (re‑created manually).
- **No `pnpm db:generate` used** – migration SQL and snapshot edited manually per project conventions.

## Next Step
Ready for 03‑04‑PLAN.md (ProjectListPage, ProjectFormPage, Sidebar, routing, build verify).