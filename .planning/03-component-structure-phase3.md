# ai-dashboard — Phase 3 Component Structure: Skills

**Phase 3 scope:** Skills — create, manage, assign to personas, inject into sessions  
**Approach:** Additive — new routes, pages, and components. One meaningful update to `PersonaFormPage`.

---

## New Routes

```
/skills              → SkillListPage
/skills/new          → SkillFormPage
/skills/:skillId     → SkillFormPage (edit mode)
```

---

## Updated Route Map (full)

```
/                          → redirect → /tasks
/tasks                     → TaskQueuePage
/tasks/new                 → TaskCreatePage
/tasks/:taskId             → TaskDetailPage
/personas                  → PersonaListPage
/personas/new              → PersonaFormPage   ← updated: adds SkillAssigner
/personas/:personaId       → PersonaFormPage   ← updated: adds SkillAssigner
/skills                    → SkillListPage      ← NEW
/skills/new                → SkillFormPage      ← NEW
/skills/:skillId           → SkillFormPage      ← NEW
/monitor                   → MonitorPage
/monitor/history           → MonitorPage/HistoryTab
/monitor/personas          → MonitorPage/PersonasTab
/monitor/trends            → MonitorPage/TrendsTab
```

---

## New Page: `SkillListPage`

Browse and manage all skill definitions.

```
<SkillListPage>
  <PageHeader title="Skills">
    <Button href="/skills/new">New Skill</Button>
  </PageHeader>

  <SkillFilterBar>
    <TagFilter />              ← filter by tag
    <SearchInput />            ← filter by name/description
  </SkillFilterBar>

  <SkillGrid>
    <SkillCard />              ← repeated per skill
    ...
  </SkillGrid>

  <EmptyState />               ← shown when no skills exist yet
</SkillListPage>
```

---

## New Page: `SkillFormPage`

Create or edit a skill. Same component, mode determined by presence of `skillId` param.

```
<SkillFormPage>
  <PageHeader title="New Skill" | "Edit Skill" />

  <SkillForm>
    <FormField name="name" />
    <FormField name="description" type="textarea" />

    <StorageToggle />               ← toggle between "Inline" and "File Path" or "Both"

    <ContentEditor>                 ← shown when inline is selected
      <FormField
        name="content"
        type="code-editor"          ← monospace textarea with markdown hint
        placeholder="Write skill content in markdown..."
      />
      <MarkdownPreview />           ← live preview panel beside/below editor
    </ContentEditor>

    <FormField
      name="filePath"
      type="text"                   ← shown when file path is selected
      placeholder="/home/aaron/.ai-dashboard/skills/my-skill.md"
    />
    <FilePathValidator />           ← shows green check or warning if path exists/missing

    <TagInput name="tags" />

    <PersonaUsageList />            ← read-only: shows which personas use this skill
                                       (empty on new skill form)

    <FormActions>
      <Button type="submit">Save Skill</Button>
      <Button variant="ghost" href="/skills">Cancel</Button>
      <Button variant="destructive" onClick={handleToggleActive}>
        {skill.isActive ? "Disable" : "Enable"}
      </Button>
    </FormActions>
  </SkillForm>
</SkillFormPage>
```

---

## Updated Page: `PersonaFormPage`

Add `SkillAssigner` section below the existing `ContextFileList`:

```
<PersonaForm>
  <FormField name="name" />
  <FormField name="description" />
  <ModelSelector />
  <FormField name="systemPrompt" type="code-editor" />
  <ToolsCheckboxGroup />
  <ContextFileList />

  <SkillAssigner personaId={personaId} />    ← NEW in Phase 3

  <TagInput name="tags" />
  <FormActions />
</PersonaForm>
```

---

## New Component: `<SkillAssigner />`

The primary Phase 3 UI component. Manages the ordered list of skills assigned to a persona.

```
<SkillAssigner>
  <SectionHeader>
    <h3>Skills</h3>
    <p class="hint">
      Skills are injected into each session after the system prompt, in the order shown.
    </p>
  </SectionHeader>

  <AssignedSkillList>             ← drag-to-reorder list of currently assigned skills
    <AssignedSkillRow skill={} sortOrder={0}>
      <DragHandle />              ← drag handle icon on left
      <SkillBadge name={} tags={} />
      <span class="type-badge">  ← "inline" or "file" badge
      <Button onClick={handleRemove}>Remove</Button>
    </AssignedSkillRow>
    ...
  </AssignedSkillList>

  <SkillSearchPicker>            ← search + select from available skills
    <SearchInput
      placeholder="Search skills to add..."
      onChange={handleSearch}
    />
    <SkillPickerDropdown>
      <SkillPickerOption />      ← each available (unassigned) skill
      ...
    </SkillPickerDropdown>
  </SkillSearchPicker>

  <EmptyState>                   ← shown when no skills assigned yet
    No skills assigned. Search above to add skills to this persona.
  </EmptyState>
</SkillAssigner>
```

**Drag-to-reorder:** Use `@dnd-kit/core` and `@dnd-kit/sortable` — lightweight, accessible, well-maintained. The ordered list maps directly to `sort_order` values persisted to `persona_skills`.

**Save behavior:** Skill assignments are saved when the persona form is submitted — not on individual add/remove actions. This keeps the UX consistent with the rest of the form and avoids partial saves.

---

## New Shared Components

### `<SkillCard />`
Used in `SkillListPage` grid.

```
<SkillCard>
  <div class="header">
    <h3>{skill.name}</h3>
    <ActiveBadge isActive={skill.isActive} />
    <StorageTypeBadge>          ← "Inline", "File", or "Both"
  </div>
  <p>{skill.description}</p>
  <TagList tags={skill.tags} />
  <div class="footer">
    <span class="usage">Used by {personaCount} persona(s)</span>
    <Link href={`/skills/${skill.id}`}>Edit</Link>
  </div>
</SkillCard>
```

### `<SkillBadge name="" tags={[]} />`
Compact inline representation of a skill — name + tag pills. Used inside `AssignedSkillRow` and anywhere a skill is referenced in context.

### `<StorageTypeBadge type="inline" | "file" | "both" />`
Small colored pill indicating how the skill's content is stored.

### `<MarkdownPreview content="" />`
Live markdown renderer for the skill content editor. Use `marked` or `react-markdown` — no syntax highlighting needed, just rendered markdown.

### `<FilePathValidator path="" />`
Calls `GET /api/skills/validate-path?path=...` on blur, shows:
- Green check: file exists and is readable
- Amber warning: path not found (file may not exist yet)
- Red error: path is outside allowed directories

### `<PersonaUsageList skillId="" />`
Read-only list of personas that currently have this skill assigned. Shown in `SkillFormPage`. Each entry links to `/personas/:personaId`.

### `<TagFilter />`
Multi-select tag filter used in `SkillListPage`. Populated from all unique tags across active skills.

---

## New API Hooks (TanStack Query)

```ts
// Skills CRUD
useSkills(filters?)
  → GET /api/skills?tag=&search=&active=
  → Skill[]
  → staleTime: 30_000

useSkill(skillId)
  → GET /api/skills/:id
  → Skill
  → staleTime: 30_000

useCreateSkill()
  → POST /api/skills

useUpdateSkill()
  → PUT /api/skills/:id

useToggleSkillActive()
  → PATCH /api/skills/:id/toggle

// Persona skill assignments
usePersonaSkills(personaId)
  → GET /api/personas/:id/skills
  → AssignedSkill[]          ← skill + sortOrder, ordered
  → staleTime: 30_000

useUpdatePersonaSkills()
  → PUT /api/personas/:id/skills   ← full replace: sends ordered array of skillIds

// Skill validation
useValidateSkillPath(path)
  → GET /api/skills/validate-path?path=
  → { exists: boolean, readable: boolean }
  → enabled only when path is non-empty
  → staleTime: 10_000
```

---

## New Backend Routes

**`routes/skills.ts`**
```
GET    /api/skills                      → list skills (query params: tag, search, active)
POST   /api/skills                      → create skill
GET    /api/skills/:id                  → get single skill
PUT    /api/skills/:id                  → update skill
PATCH  /api/skills/:id/toggle           → toggle isActive
GET    /api/skills/validate-path        → validate VM file path (?path=...)
```

**Additions to `routes/personas.ts`**
```
GET    /api/personas/:id/skills         → get ordered skill assignments for a persona
PUT    /api/personas/:id/skills         → replace all skill assignments (ordered array)
```

---

## New Backend Service

**`services/skillService.ts`**

```ts
// CRUD
listSkills(filters: { tag?: string, search?: string, active?: boolean }): Promise<Skill[]>
getSkill(skillId: string): Promise<Skill | null>
createSkill(data: NewSkill): Promise<Skill>
updateSkill(skillId: string, data: Partial<Skill>): Promise<Skill>
toggleActive(skillId: string): Promise<Skill>

// Persona assignments
getPersonaSkills(personaId: string): Promise<AssignedSkill[]>
  // returns skills joined with persona_skills, ordered by sort_order

updatePersonaSkills(personaId: string, skillIds: string[]): Promise<void>
  // full replace: delete all, re-insert with index as sort_order

// Validation
validateFilePath(path: string): Promise<{ exists: boolean, readable: boolean }>
  // uses fs.access() to check readability
  // restrict to allowed base directories from env for security

// Used by sessionRunner
resolveSkillsForPersona(personaId: string): Promise<ResolvedSkill[]>
  // fetches ordered skills, resolves content (file or inline), returns ready-to-inject array
```

---

## Update to `sessionRunner.ts`

Add skill injection between system prompt and task prompt:

```ts
// 1. Inject persona system prompt
await client.session.prompt({
  path: { id: session.data.id },
  body: { noReply: true, parts: [{ type: "text", text: persona.systemPrompt }] }
})

// 2. Inject skills in order          ← NEW in Phase 3
const resolvedSkills = await skillService.resolveSkillsForPersona(persona.id)
for (const skill of resolvedSkills) {
  if (!skill.content) continue        // skip if content couldn't be resolved
  await client.session.prompt({
    path: { id: session.data.id },
    body: {
      noReply: true,
      parts: [{ type: "text", text: `## Skill: ${skill.name}\n\n${skill.content}` }]
    }
  })
}

// 3. Send the actual task prompt
await client.session.prompt({
  path: { id: session.data.id },
  body: { parts: [{ type: "text", text: task.description }] }
})
```

---

## Updated Sidebar

Add Skills link:
```
/tasks      → Task Queue
/personas   → Personas
/skills     → Skills          ← NEW
/monitor    → Monitor
```

---

## Updated Folder Structure

Additions only:

```
packages/server/src/
  routes/
    skills.ts                 ← NEW
  services/
    skillService.ts           ← NEW
  db/
    schema.ts                 ← ADD skills + persona_skills tables

packages/client/src/
  api/
    skills.ts                 ← NEW TanStack Query hooks
  components/
    skills/                   ← NEW
      SkillCard.tsx
      SkillForm.tsx
      SkillAssigner.tsx
      AssignedSkillRow.tsx
      SkillSearchPicker.tsx
      SkillBadge.tsx
      StorageTypeBadge.tsx
      MarkdownPreview.tsx
      FilePathValidator.tsx
      PersonaUsageList.tsx
      TagFilter.tsx
  pages/
    SkillListPage.tsx         ← NEW
    SkillFormPage.tsx         ← NEW
  layouts/
    Sidebar.tsx               ← UPDATE: add Skills link
```

---

## New Client Dependencies

Add to `packages/client/package.json`:
```json
{
  "@dnd-kit/core": "^6.0.0",
  "@dnd-kit/sortable": "^7.0.0",
  "@dnd-kit/utilities": "^3.0.0",
  "react-markdown": "^9.0.0"
}
```

No new server dependencies.

---

## Preset Skills to Document in README

Suggest these as starter skills for users to create after setup:

| Skill Name | Tags | Storage |
|------------|------|---------|
| `typescript-strict` | typescript, quality | Inline |
| `owasp-top10` | security, review | Inline |
| `aws-cdk-conventions` | aws, cdk, infrastructure | File |
| `pr-review-checklist` | review, quality | Inline |
| `zod-validation-patterns` | typescript, validation | Inline |
| `react-best-practices` | react, frontend | File |
| `secrets-detection` | security | Inline |
| `conventional-commits` | git, workflow | Inline |
