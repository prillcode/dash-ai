# ai-dashboard — Phase 3 Data Model: Skills

**Phase 3 scope:** Skills — reusable domain knowledge units assignable to personas  
**Stack:** Same as Phase 1/2 — Turso/libSQL via Drizzle ORM  
**Approach:** Additive only — no Phase 1 or Phase 2 schema changes required

---

## Design Decisions

- Skills support **dual storage** — inline markdown in the DB for simple skills, VM filesystem path for complex ones. Both fields are nullable; at least one must be populated (enforced at app layer)
- Skills are **reusable across personas** via a many-to-many join table with explicit ordering
- Injection order within a persona is **user-controlled** — the `sort_order` field on `persona_skills` determines which skills are injected first
- Skills are injected **after** the persona system prompt, as separate `noReply` context messages in the OpenCode session
- **Tags** are stored as a JSON array string (same pattern as Phase 1 `allowedTools`) for filtering and grouping in the UI
- No versioning — `updated_at` timestamp is sufficient for a homelab tool

---

## New Tables

### `skills` table

One record per skill definition. Content is either inline markdown, a VM file path, or both.

```sql
CREATE TABLE skills (
  id           TEXT PRIMARY KEY,                  -- nanoid
  name         TEXT NOT NULL UNIQUE,              -- e.g. "owasp-top10", "typescript-strict"
  description  TEXT NOT NULL DEFAULT '',          -- human-readable summary
  content      TEXT,                              -- inline markdown (nullable)
  file_path    TEXT,                              -- absolute VM path to .md file (nullable)
  tags         TEXT NOT NULL DEFAULT '[]',        -- JSON array string
  is_active    INTEGER NOT NULL DEFAULT 1,        -- soft delete
  created_at   TEXT NOT NULL,
  updated_at   TEXT NOT NULL
);

-- Constraint: at least one of content or file_path must be non-null
-- Enforced at app layer in skillService.ts

CREATE INDEX idx_skills_is_active  ON skills(is_active);
CREATE INDEX idx_skills_name       ON skills(name);
```

**Drizzle schema:**
```ts
export const skills = sqliteTable("skills", {
  id:          text("id").primaryKey(),
  name:        text("name").notNull().unique(),
  description: text("description").notNull().default(""),
  content:     text("content"),                          // inline markdown
  filePath:    text("file_path"),                        // VM filesystem path
  tags:        text("tags").notNull().default("[]"),     // JSON array string
  isActive:    integer("is_active", { mode: "boolean" }).notNull().default(true),
  createdAt:   text("created_at").notNull(),
  updatedAt:   text("updated_at").notNull(),
})
```

**Example rows:**
```json
[
  {
    "id": "sk_abc123",
    "name": "owasp-top10",
    "description": "OWASP Top 10 security vulnerabilities awareness and mitigation patterns",
    "content": "# OWASP Top 10\n\nWhen reviewing or writing code, always check for...",
    "file_path": null,
    "tags": "[\"security\",\"review\"]",
    "is_active": 1,
    "created_at": "2025-02-18T10:00:00Z",
    "updated_at": "2025-02-18T10:00:00Z"
  },
  {
    "id": "sk_def456",
    "name": "aws-cdk-conventions",
    "description": "Detailed AWS CDK patterns, construct conventions, and naming standards",
    "content": null,
    "file_path": "/home/aaron/.ai-dashboard/skills/aws-cdk-conventions.md",
    "tags": "[\"aws\",\"cdk\",\"infrastructure\"]",
    "is_active": 1,
    "created_at": "2025-02-18T10:00:00Z",
    "updated_at": "2025-02-18T10:00:00Z"
  }
]
```

---

### `persona_skills` table

Many-to-many join between personas and skills. `sort_order` controls injection sequence.

```sql
CREATE TABLE persona_skills (
  id          TEXT PRIMARY KEY,                   -- nanoid
  persona_id  TEXT NOT NULL REFERENCES personas(id) ON DELETE CASCADE,
  skill_id    TEXT NOT NULL REFERENCES skills(id) ON DELETE CASCADE,
  sort_order  INTEGER NOT NULL DEFAULT 0,         -- lower = injected first
  created_at  TEXT NOT NULL,

  UNIQUE(persona_id, skill_id)                    -- no duplicate assignments
);

CREATE INDEX idx_persona_skills_persona_id ON persona_skills(persona_id);
CREATE INDEX idx_persona_skills_skill_id   ON persona_skills(skill_id);
```

**Drizzle schema:**
```ts
export const personaSkills = sqliteTable("persona_skills", {
  id:        text("id").primaryKey(),
  personaId: text("persona_id").notNull().references(() => personas.id, { onDelete: "cascade" }),
  skillId:   text("skill_id").notNull().references(() => skills.id, { onDelete: "cascade" }),
  sortOrder: integer("sort_order").notNull().default(0),
  createdAt: text("created_at").notNull(),
}, (table) => ({
  uniquePersonaSkill: unique().on(table.personaId, table.skillId),
}))
```

**Example rows** (security-analyst persona with 3 skills):
```json
[
  { "id": "ps_1", "persona_id": "p_sec", "skill_id": "sk_abc123", "sort_order": 0 },
  { "id": "ps_2", "persona_id": "p_sec", "skill_id": "sk_def456", "sort_order": 1 },
  { "id": "ps_3", "persona_id": "p_sec", "skill_id": "sk_ghi789", "sort_order": 2 }
]
```

---

## Query Patterns

**Get all skills for a persona (ordered for injection):**
```ts
db.select({
  skill: skills,
  sortOrder: personaSkills.sortOrder,
})
.from(personaSkills)
.innerJoin(skills, eq(personaSkills.skillId, skills.id))
.where(
  and(
    eq(personaSkills.personaId, personaId),
    eq(skills.isActive, true)
  )
)
.orderBy(asc(personaSkills.sortOrder))
```

**Get all active skills (for assignment UI):**
```ts
db.select()
.from(skills)
.where(eq(skills.isActive, true))
.orderBy(asc(skills.name))
```

**Get all personas using a skill (for skill detail view):**
```ts
db.select({
  persona: personas,
})
.from(personaSkills)
.innerJoin(personas, eq(personaSkills.personaId, personas.id))
.where(eq(personaSkills.skillId, skillId))
```

**Reorder skills for a persona (full replace pattern):**
```ts
// Delete all existing assignments, re-insert with new sort_order values
// Simpler and safer than individual updates for a small ordered list
await db.delete(personaSkills).where(eq(personaSkills.personaId, personaId))
await db.insert(personaSkills).values(newOrderedAssignments)
```

---

## Skill Content Resolution

At session runtime, `sessionRunner.ts` resolves each skill's content in this order:

```ts
async function resolveSkillContent(skill: Skill): Promise<string> {
  // 1. If file_path is set, read from filesystem (file takes precedence for complex skills)
  if (skill.filePath) {
    try {
      return await fs.readFile(skill.filePath, "utf-8")
    } catch (err) {
      console.warn(`Could not read skill file ${skill.filePath}, falling back to inline content`)
    }
  }

  // 2. Fall back to inline content
  if (skill.content) {
    return skill.content
  }

  // 3. Neither available — log warning, skip skill gracefully
  console.warn(`Skill ${skill.name} has no resolvable content — skipping`)
  return ""
}
```

---

## Session Injection Pattern

Skills are injected after the system prompt, before the task prompt, each as a separate `noReply` context message:

```
Session message sequence:
  1. [noReply] Persona system prompt
  2. [noReply] Skill: owasp-top10        ← sort_order: 0
  3. [noReply] Skill: aws-cdk-conventions ← sort_order: 1
  4. [noReply] Skill: secrets-detection   ← sort_order: 2
  5. [prompt]  Task description           ← triggers AI response
```

Each skill message is wrapped with a header so the agent understands what it's receiving:

```ts
const skillMessage = `## Skill: ${skill.name}\n\n${resolvedContent}`
```

---

## Validation Rules (enforced at app layer)

- At least one of `content` or `filePath` must be non-null on create/update
- `name` must be unique across all skills
- `sortOrder` values in `persona_skills` should be non-negative integers
- If a skill's file path is set, validate the file exists on create/update (warn but don't block)
- Deleting a skill cascades via `ON DELETE CASCADE` — no orphaned `persona_skills` records

---

## Phase 1/2 Schema Modifications

None. The new tables reference `personas` via foreign key but add no columns to existing tables.

---

## New Dependencies

None — no new DB dependencies required.
