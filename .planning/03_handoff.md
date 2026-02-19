# ai-dashboard — Phase 3 Claude Code Handoff: Skills

## What You Are Building

Phase 3 adds a **Skills** system to ai-dashboard. Skills are reusable domain knowledge units — markdown content injected into OpenCode sessions after the persona system prompt and before the task prompt. They are assignable to personas in a user-controlled order.

Reference documents (read all before writing any code):
- `.planning/03-data-model-phase3.md` — two new tables, query patterns, content resolution logic, injection sequence
- `.planning/03-component-structure-phase3.md` — new pages, components, routes, service, and the two Phase 1/2 files that need updating
- `.planning/01-data-model-option-b.md` — Phase 1 schema (existing `personas` table)
- `.planning/01-component-structure-option-b.md` — Phase 1 structure (existing `PersonaFormPage`)

---

## Assumptions

Phases 1 and 2 are complete and working:
- `personas`, `tasks`, `task_events`, `model_pricing`, `session_costs` tables exist
- All Phase 1/2 routes, services, and components are functional
- `sessionRunner.ts` runs OpenCode sessions, captures costs, writes diffs

---

## Phase 3 Deliverables

### 1. Database — Two New Tables

Add to `packages/server/src/db/schema.ts`:
- `skills` table
- `personaSkills` join table (with `unique` constraint and `ON DELETE CASCADE`)

Defined in full in `data-model-phase3.md`. Add all indexes.

Then run:
```bash
pnpm db:generate
pnpm db:migrate
```

### 2. Skill Service

Create `packages/server/src/services/skillService.ts` implementing all methods from `component-structure-phase3.md`:

- `listSkills(filters)` — supports tag, search (name/description LIKE), active filter
- `getSkill(skillId)`
- `createSkill(data)` — validate that at least one of `content` or `filePath` is non-null
- `updateSkill(skillId, data)`
- `toggleActive(skillId)`
- `getPersonaSkills(personaId)` — join with skills table, order by `sort_order`
- `updatePersonaSkills(personaId, skillIds)` — full replace pattern: delete all, re-insert with array index as `sort_order`
- `validateFilePath(path)` — use `fs.access(path, fs.constants.R_OK)`. Security: only allow paths under `SKILLS_BASE_DIR` env var (add to `.env.example`). Return `{ exists: boolean, readable: boolean }`
- `resolveSkillsForPersona(personaId)` — fetch ordered skills, resolve content using the fallback logic from `data-model-phase3.md` (file → inline → skip with warning), return array of `{ name, content }` ready for injection

### 3. Skills Routes

Create `packages/server/src/routes/skills.ts`:
```
GET    /api/skills                    → listSkills (query: tag, search, active)
POST   /api/skills                    → createSkill
GET    /api/skills/:id                → getSkill
PUT    /api/skills/:id                → updateSkill
PATCH  /api/skills/:id/toggle         → toggleActive
GET    /api/skills/validate-path      → validateFilePath (?path=)
```

**Important:** Register `GET /api/skills/validate-path` BEFORE `GET /api/skills/:id` in the route file — otherwise Hono will try to match `validate-path` as a skill ID.

Add to `packages/server/src/routes/personas.ts`:
```
GET    /api/personas/:id/skills       → getPersonaSkills
PUT    /api/personas/:id/skills       → updatePersonaSkills (body: { skillIds: string[] })
```

Mount `skillsRouter` in `src/index.ts` under `/api/skills`.

### 4. Environment Variable Addition

Add to `.env.example`:
```bash
# Base directory for file-based skills (validate-path restricted to this dir)
SKILLS_BASE_DIR=/home/user/.ai-dashboard/skills
```

### 5. Update `sessionRunner.ts`

Add skill injection between persona system prompt and task prompt as defined in `component-structure-phase3.md`. The injection loop:
- Calls `skillService.resolveSkillsForPersona(persona.id)`
- Skips skills with empty resolved content (warn, don't throw)
- Wraps each in `## Skill: {name}\n\n{content}` header
- Sends each as a separate `noReply` context message

### 6. New Client API Hooks

Create `packages/client/src/api/skills.ts` with all TanStack Query hooks from `component-structure-phase3.md`. Key notes:
- `useValidateSkillPath(path)` — only enabled when `path.trim().length > 0`, runs on blur not on every keystroke
- `usePersonaSkills(personaId)` — only enabled when `personaId` is defined (edit mode only, not on new persona form)
- `useUpdatePersonaSkills()` — sends `{ skillIds: string[] }` in order (index = sort_order)

### 7. New UI Primitives

Add to `packages/client/src/components/ui/`:

**`MarkdownPreview.tsx`** — install `react-markdown`:
```bash
pnpm --filter client add react-markdown
```
Simple wrapper: `<ReactMarkdown>{content}</ReactMarkdown>` with Tailwind prose styling (`prose prose-sm max-w-none`).

**`TagFilter.tsx`** — multi-select filter that accepts `tags: string[]` (all available tags) and emits `selectedTags: string[]`. Style as a row of toggleable pill buttons.

### 8. Drag-to-Reorder — Install dnd-kit

```bash
pnpm --filter client add @dnd-kit/core @dnd-kit/sortable @dnd-kit/utilities
```

`AssignedSkillRow` uses `useSortable` from `@dnd-kit/sortable`. `SkillAssigner` wraps the list in `<DndContext>` and `<SortableContext>`. On drag end, reorder the local array and update `sort_order` accordingly. The reordered array is submitted with the persona form — not saved immediately on drag.

### 9. New Skill Components

Create all components in `packages/client/src/components/skills/` as defined in `component-structure-phase3.md`:

**`SkillAssigner.tsx`** — the most complex component. Key implementation details:
- Maintains local state: `assignedSkills: AssignedSkill[]`
- On mount (edit mode): initialize from `usePersonaSkills(personaId)`
- On form submit: parent `PersonaFormPage` calls `useUpdatePersonaSkills()` with the current ordered skill IDs — wire this via `onSubmit` callback or React Hook Form's `handleSubmit`
- Search picker filters out already-assigned skills from the available list
- Adding a skill appends it to the end of `assignedSkills` with the next `sort_order`
- Removing a skill splices it from the array and renumbers `sort_order`

**`FilePathValidator.tsx`** — debounce the `useValidateSkillPath` call by 500ms after the field loses focus. Show a spinner while validating, green check if `readable`, amber warning if `!exists`, red if there's an error.

**`StorageToggle.tsx`** — controls which fields are visible in `SkillFormPage`. Three states: "Inline only", "File path only", "Both". Store as local `useState`, show/hide `ContentEditor` and file path field accordingly. Validation: if "Inline only" selected, require `content`. If "File path only", require `filePath`. If "Both", require both.

**`PersonaUsageList.tsx`** — fetches personas using a skill via a new hook `useSkillPersonas(skillId)` → `GET /api/skills/:id/personas`. Add this route to `routes/skills.ts` — it's a simple join query.

### 10. New Pages

**`SkillListPage.tsx`** — grid layout, `TagFilter` + search input wire to `useSkills(filters)`. Filter state lives in `useState`, passed to the query hook. Graceful empty state for zero skills.

**`SkillFormPage.tsx`** — determine edit vs. create mode from `useParams()`. On edit: load skill with `useSkill(skillId)`, initialize form with `react-hook-form` `reset()`. On create: empty form. Submit calls `useCreateSkill()` or `useUpdateSkill()` accordingly. Navigate to `/skills` on success.

### 11. Update `PersonaFormPage`

Add `<SkillAssigner personaId={personaId} ref={skillAssignerRef} />` to the form. On persona form submit:
1. Submit persona fields (existing behavior)
2. If edit mode and skill assignments changed, call `useUpdatePersonaSkills()` with the current ordered skill IDs from `SkillAssigner`
3. Navigate to `/personas` only after both succeed

For new persona creation: create the persona first to get the `personaId`, then submit skill assignments if any were added.

### 12. Update Sidebar

Add Skills link between Personas and Monitor in `packages/client/src/layouts/Sidebar.tsx`.

### 13. Update App Router

Add to `packages/client/src/App.tsx`:
```tsx
<Route path="/skills" element={<SkillListPage />} />
<Route path="/skills/new" element={<SkillFormPage />} />
<Route path="/skills/:skillId" element={<SkillFormPage />} />
```

### 14. Update README

Add a Skills section covering:
- What skills are and how they work
- Creating inline vs. file-based skills
- The `SKILLS_BASE_DIR` env var and suggested directory structure
- Suggested starter skills (see table in `component-structure-phase3.md`)
- How to create skill files: `~/.ai-dashboard/skills/my-skill.md`

---

## Build and Verification Order

1. Schema additions + `pnpm db:generate && pnpm db:migrate`
2. `skillService.ts`
3. `routes/skills.ts` + persona skill routes
4. Update `sessionRunner.ts`
5. `pnpm --filter server tsc --noEmit` — fix all type errors
6. Install client deps: `pnpm --filter client add @dnd-kit/core @dnd-kit/sortable @dnd-kit/utilities react-markdown`
7. New UI primitives (`MarkdownPreview`, `TagFilter`)
8. Skill components (build in this order: `SkillBadge` → `StorageTypeBadge` → `SkillCard` → `FilePathValidator` → `MarkdownPreview` → `PersonaUsageList` → `AssignedSkillRow` → `SkillSearchPicker` → `SkillAssigner`)
9. `SkillListPage` and `SkillFormPage`
10. Update `PersonaFormPage`
11. Update Sidebar and App router
12. `pnpm --filter client tsc --noEmit` — fix all type errors
13. `pnpm dev` — smoke test the full skill flow: create skill → assign to persona → submit task → verify injection in session event log

---

## Important Notes for Claude Code

- Register `GET /api/skills/validate-path` before `GET /api/skills/:id` in the route file — route order matters in Hono
- `updatePersonaSkills` uses a full-replace pattern (delete + re-insert) — this is intentional and safe since it runs in a single transaction. Wrap in a Drizzle transaction: `db.transaction(async (tx) => { ... })`
- `SKILLS_BASE_DIR` security: `validateFilePath` must use `path.resolve()` and check that the resolved path starts with the resolved `SKILLS_BASE_DIR` — prevent path traversal attacks (`../../etc/passwd` style)
- File-based skill content is read at session runtime, not cached — changes to skill files take effect on the next task run without any dashboard interaction
- For new persona creation with skills: create persona → get returned `personaId` → submit skill assignments. Handle the case where skill assignment fails after persona creation — log the error but don't roll back the persona (skills can be assigned later)
- `SkillAssigner` should work in both create mode (no `personaId` yet, buffer assignments locally) and edit mode (has `personaId`, loads existing assignments)
- dnd-kit requires accessible drag handles — use `aria-label="Drag to reorder"` on the `DragHandle` element
- `react-markdown` renders user-controlled content — add `className="prose prose-sm max-w-none dark:prose-invert"` for readable Tailwind typography styling
- pnpm only — never use npm or yarn for any package operations
