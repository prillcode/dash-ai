# ai-dashboard — Phase 4 Claude Code Handoff: Projects

## What You Are Building

Phase 4 adds a **Projects** system to ai-dashboard. Projects are registered local repositories on the machine running the server. Instead of typing a raw file path when creating a task, users select from a pre-configured list of projects. The server resolves the project path at runtime relative to the user's home directory.

Reference documents (read all before writing any code):
- `.planning/04-data-model-phase4.md` — new table, query patterns
- `.planning/04-component-structure-phase4.md` — new pages, components, routes, and files that need updating
- `.planning/01-data-model-option-b.md` — Phase 1 schema (existing `tasks` table)

---

## Assumptions

Phases 1, 2, and 3 are complete and working:
- `personas`, `tasks`, `task_events`, `model_pricing`, `session_costs`, `skills`, `persona_skills` tables exist
- All prior routes, services, and components are functional
- `sessionRunner.ts` runs OpenCode sessions, captures costs, injects skills

---

## Motivation

The free-text `repoPath` field on the task form is error-prone — typos, inconsistent paths, and no validation until the session actually runs. Projects solves this by:

1. Registering repos once with a name and path
2. Validating the path exists at registration time
3. Letting users select from a dropdown when creating tasks
4. Resolving the absolute path server-side at session runtime using `os.homedir()`

---

## Phase 4 Deliverables

### 1. Database — One New Table

Add to `packages/server/src/db/schema.ts`:

```ts
export const projects = sqliteTable("projects", {
  id:          text("id").primaryKey(),
  name:        text("name").notNull().unique(),
  description: text("description").notNull().default(""),
  path:        text("path").notNull(),             // absolute or ~/relative path
  isActive:    integer("is_active", { mode: "boolean" }).notNull().default(true),
  createdAt:   text("created_at").notNull(),
  updatedAt:   text("updated_at").notNull(),
}, (table) => ({
  isActiveIdx: index("idx_projects_is_active").on(table.isActive),
  nameIdx:     index("idx_projects_name").on(table.name),
}))
```

**Path storage convention:**
- Store paths as-is from the user (e.g. `~/projects/my-app` or `/home/prill/projects/my-app`)
- Resolve `~` to `os.homedir()` at runtime in `projectService.resolvePath()`
- Never store resolved absolute paths — the home directory may change between environments

Then run:
```bash
pnpm db:generate
pnpm db:migrate
```

### 2. Update `tasks` table

Add a `project_id` foreign key to the `tasks` table (nullable for backward compatibility with existing tasks):

```ts
projectId: text("project_id").references(() => projects.id),
```

Run:
```bash
pnpm db:generate
pnpm db:migrate
```

### 3. Project Service

Create `packages/server/src/services/projectService.ts`:

```ts
import os from "os"
import path from "path"
import fs from "fs/promises"

// Resolve ~ to home directory
export function resolvePath(rawPath: string): string {
  if (rawPath.startsWith("~/") || rawPath === "~") {
    return path.join(os.homedir(), rawPath.slice(1))
  }
  return rawPath
}

// Validate path exists and is a directory
export async function validatePath(rawPath: string): Promise<{ exists: boolean; isDirectory: boolean }> {
  const resolved = resolvePath(rawPath)
  try {
    const stat = await fs.stat(resolved)
    return { exists: true, isDirectory: stat.isDirectory() }
  } catch {
    return { exists: false, isDirectory: false }
  }
}

// CRUD
listProjects(activeOnly?: boolean): Promise<Project[]>
getProject(projectId: string): Promise<Project | null>
createProject(data: NewProject): Promise<Project>
updateProject(projectId: string, data: Partial<Project>): Promise<Project>
toggleActive(projectId: string): Promise<Project>
deleteProject(projectId: string): Promise<void>
```

### 4. Projects Routes

Create `packages/server/src/routes/projects.ts`:

```
GET    /api/projects                → listProjects (query: activeOnly)
POST   /api/projects                → createProject (validates path on create)
GET    /api/projects/:id            → getProject
PUT    /api/projects/:id            → updateProject
PATCH  /api/projects/:id/toggle     → toggleActive
DELETE /api/projects/:id            → deleteProject
GET    /api/projects/validate-path  → validatePath (?path=)
```

**Important:** Register `GET /api/projects/validate-path` BEFORE `GET /api/projects/:id` — same Hono route order rule as Phase 3 skills.

Mount `projectsRouter` in `src/index.ts` under `/api/projects`.

### 5. Update `sessionRunner.ts`

Replace raw `task.repoPath` usage with resolved project path:

```ts
import { resolvePath } from "../services/projectService"

// At session start, resolve the working directory
const workingDir = task.projectPath
  ? resolvePath(task.projectPath)
  : resolvePath(task.repoPath) // fallback for legacy tasks
```

### 6. Update `taskService.ts`

- Include `projectId` in task create/update
- Join with `projects` table when fetching tasks to include project name and resolved path
- `claimNextPendingTask()` should return project path alongside task data for `sessionRunner`

### 7. Error Handling — Provider Auth Failure

Update `sessionRunner.ts` to detect OpenCode provider auth errors and surface a clear message:

```ts
} catch (error) {
  const message = error instanceof Error ? error.message : String(error)
  const isAuthError =
    message.toLowerCase().includes("unauthorized") ||
    message.toLowerCase().includes("invalid api key") ||
    message.toLowerCase().includes("authentication")

  const userMessage = isAuthError
    ? "Provider authentication failed. Please re-authorize your API key in OpenCode directly (run `opencode auth` on the server)."
    : message

  await taskService.updateTask(taskId, {
    status: TaskStatus.FAILED,
    errorMessage: userMessage,
  })
}
```

### 8. New Client API Hooks

Create `packages/client/src/api/projects.ts`:

```ts
useProjects(activeOnly?: boolean)
  → GET /api/projects?activeOnly=true
  → Project[]
  → staleTime: 60_000

useProject(projectId: string)
  → GET /api/projects/:id
  → Project
  → staleTime: 60_000

useCreateProject()
  → POST /api/projects

useUpdateProject()
  → PUT /api/projects/:id

useToggleProjectActive()
  → PATCH /api/projects/:id/toggle

useDeleteProject()
  → DELETE /api/projects/:id

useValidateProjectPath(path: string)
  → GET /api/projects/validate-path?path=
  → { exists: boolean, isDirectory: boolean }
  → enabled only when path is non-empty
  → staleTime: 10_000
```

### 9. New UI Primitives

Add to `packages/client/src/components/ui/`:

**`ProjectSelector.tsx`** — dropdown that fetches active projects and emits `{ projectId, projectName, projectPath }`. Replaces the free-text `repoPath` field in `TaskForm`. Shows project name + path as hint text.

### 10. New Components

Create `packages/client/src/components/projects/`:

**`ProjectCard.tsx`** — displays project name, description, resolved path, active status. Edit link + toggle active button.

**`ProjectForm.tsx`** — React Hook Form + Zod. Fields: name, description, path. Includes `PathValidator` (reuse pattern from Phase 3 `FilePathValidator`) that calls `useValidateProjectPath` on blur. Shows green check if path exists and is a directory, red if not.

**`PathValidator.tsx`** — identical pattern to Phase 3 `FilePathValidator` but for directories. Shows:
- Green check: path exists and is a directory
- Amber warning: path does not exist yet
- Red error: path exists but is not a directory (it's a file)

### 11. New Pages

**`ProjectListPage.tsx`** — grid of `ProjectCard` components. Empty state with prompt to add first project. "New Project" button.

**`ProjectFormPage.tsx`** — create/edit mode from `useParams()`. On success, navigate to `/projects`.

### 12. Update `TaskForm`

Replace the free-text `repoPath` field with `ProjectSelector`:

```tsx
// Before (Phase 1):
<FormField
  label="Repository Path"
  register={register("repoPath")}
  placeholder="/home/user/projects/my-app"
/>

// After (Phase 4):
<div className="space-y-1">
  <label className="block text-sm font-medium text-gray-700">Project</label>
  <ProjectSelector
    value={formValues.projectId}
    onChange={(projectId, projectName, projectPath) => {
      setValue("projectId", projectId)
      setValue("repoPath", projectPath) // keep repoPath for backward compat
    }}
  />
</div>
```

### 13. Update Sidebar

Add Projects link:

```
/tasks      → Task Queue
/personas   → Personas
/skills     → Skills
/projects   → Projects     ← NEW
/monitor    → Monitor
```

### 14. Update App Router

Add to `packages/client/src/App.tsx`:

```tsx
<Route path="/projects"      element={<ProjectListPage />} />
<Route path="/projects/new"  element={<ProjectFormPage />} />
<Route path="/projects/:id"  element={<ProjectFormPage />} />
```

### 15. Update TypeScript Types

Add to `packages/client/src/types/`:

**`project.ts`**:
```ts
export interface Project {
  id: string
  name: string
  description: string
  path: string          // as stored (may include ~)
  isActive: boolean
  createdAt: string
  updatedAt: string
}

export interface ProjectInput {
  name: string
  description?: string
  path: string
}
```

Update `task.ts` to include optional `projectId` and `projectName`.

---

## Build and Verification Order

1. Schema additions + `pnpm db:generate && pnpm db:migrate`
2. `projectService.ts`
3. `routes/projects.ts` + mount in `index.ts`
4. Update `taskService.ts` + `sessionRunner.ts`
5. `pnpm --filter server tsc --noEmit` — fix all server type errors
6. Client types (`project.ts`, update `task.ts`)
7. `packages/client/src/api/projects.ts`
8. UI primitives (`ProjectSelector`, `PathValidator`)
9. Project components (`ProjectCard`, `ProjectForm`)
10. `ProjectListPage` + `ProjectFormPage`
11. Update `TaskForm` to use `ProjectSelector`
12. Update Sidebar + App router
13. `pnpm --filter client tsc --noEmit` — fix all client type errors
14. `pnpm build` — full build verification
15. Smoke test: create project → create task using project → verify session uses correct path

---

## Important Notes for Claude Code

- `resolvePath()` must handle both `~/...` and absolute paths — never assume all paths start with `~`
- Register `GET /api/projects/validate-path` BEFORE `GET /api/projects/:id` in the route file
- `projectId` on tasks is nullable — existing tasks without a project must still display and run correctly
- `ProjectSelector` should show a helpful empty state if no projects exist yet: *"No projects configured. Add a project first."* with a link to `/projects/new`
- `PathValidator` validates directories, not files — it should reject paths that point to a file
- The `deleteProject` route should check if any tasks reference the project and warn (but not block) — soft delete via `toggleActive` is preferred over hard delete
- pnpm only — never use npm or yarn
