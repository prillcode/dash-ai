# AI Agent Dashboard — Data Model (Option B)

**Stack:** Node.js + Hono (Homelab VM) + Turso Cloud (libSQL/SQLite)  
**Scope:** Personas + Task Queue (Phase 1)

---

## Design Principles

- Relational schema — Turso/libSQL gives us proper SQL so we use it
- Normalized where it makes sense, denormalized only for display performance
- `nanoid` for all primary keys (URL-safe, short, no auto-increment collisions)
- All timestamps stored as ISO 8601 strings (SQLite has no native datetime type)
- Diffs and session logs stored in S3 or local filesystem, referenced by path/key
- Migrations managed via `drizzle-orm` (pairs naturally with Turso's libSQL driver)

---

## Turso Setup Notes

```ts
// Connection
import { createClient } from "@libsql/client";
import { drizzle } from "drizzle-orm/libsql";

const client = createClient({
  url: process.env.TURSO_DATABASE_URL,     // libsql://your-db.turso.io
  authToken: process.env.TURSO_AUTH_TOKEN,
});

export const db = drizzle(client);
```

Turso supports embedded replicas — you can run a local replica on the VM for low-latency reads and sync to Turso Cloud, which is ideal for homelab use.

```ts
// Embedded replica (faster local reads, syncs to Turso Cloud)
const client = createClient({
  url: "file:/home/aaron/.ai-dashboard/local.db",         // local replica path
  syncUrl: process.env.TURSO_DATABASE_URL,
  authToken: process.env.TURSO_AUTH_TOKEN,
});
```

---

## Schema

### `personas` table

```sql
CREATE TABLE personas (
  id          TEXT PRIMARY KEY,                        -- nanoid
  name        TEXT NOT NULL,
  description TEXT NOT NULL DEFAULT '',
  system_prompt TEXT NOT NULL,
  model       TEXT NOT NULL DEFAULT 'claude-sonnet-4-5',
  allowed_tools TEXT NOT NULL DEFAULT '[]',            -- JSON array string
  context_files TEXT NOT NULL DEFAULT '[]',            -- JSON array string
  tags        TEXT NOT NULL DEFAULT '[]',              -- JSON array string
  is_active   INTEGER NOT NULL DEFAULT 1,              -- boolean (0/1)
  created_at  TEXT NOT NULL,                           -- ISO 8601
  updated_at  TEXT NOT NULL                            -- ISO 8601
);

CREATE INDEX idx_personas_is_active ON personas(is_active);
CREATE INDEX idx_personas_created_at ON personas(created_at);
```

**Drizzle schema definition:**
```ts
import { sqliteTable, text, integer } from "drizzle-orm/sqlite-core";

export const personas = sqliteTable("personas", {
  id:            text("id").primaryKey(),
  name:          text("name").notNull(),
  description:   text("description").notNull().default(""),
  systemPrompt:  text("system_prompt").notNull(),
  model:         text("model").notNull().default("claude-sonnet-4-5"),
  allowedTools:  text("allowed_tools").notNull().default("[]"),   // serialize/deserialize JSON
  contextFiles:  text("context_files").notNull().default("[]"),
  tags:          text("tags").notNull().default("[]"),
  isActive:      integer("is_active", { mode: "boolean" }).notNull().default(true),
  createdAt:     text("created_at").notNull(),
  updatedAt:     text("updated_at").notNull(),
});
```

**Example row:**
```json
{
  "id": "p_abc123",
  "name": "Implementer",
  "description": "Writes production code from task descriptions",
  "system_prompt": "You are a senior TypeScript engineer...",
  "model": "claude-sonnet-4-5",
  "allowed_tools": "[\"bash\",\"read\",\"write\",\"edit\"]",
  "context_files": "[\"src/tsconfig.json\",\"ARCHITECTURE.md\"]",
  "tags": "[\"typescript\",\"backend\"]",
  "is_active": 1,
  "created_at": "2025-02-18T10:00:00Z",
  "updated_at": "2025-02-18T10:00:00Z"
}
```

---

### `tasks` table

```sql
CREATE TABLE tasks (
  id            TEXT PRIMARY KEY,                      -- nanoid
  title         TEXT NOT NULL,
  description   TEXT NOT NULL,
  persona_id    TEXT NOT NULL REFERENCES personas(id),
  persona_name  TEXT NOT NULL,                         -- denormalized for display
  status        TEXT NOT NULL DEFAULT 'PENDING',
  priority      INTEGER NOT NULL DEFAULT 3,            -- 1 (highest) to 5 (lowest)
  repo_path     TEXT NOT NULL,
  target_files  TEXT NOT NULL DEFAULT '[]',            -- JSON array string
  session_id    TEXT,                                  -- OpenCode session ID
  output_log    TEXT,                                  -- file path or S3 key
  diff_path     TEXT,                                  -- file path or S3 key
  error_message TEXT,
  reviewed_by   TEXT,
  review_note   TEXT,
  started_at    TEXT,
  completed_at  TEXT,
  created_at    TEXT NOT NULL,
  updated_at    TEXT NOT NULL
);

CREATE INDEX idx_tasks_status ON tasks(status);
CREATE INDEX idx_tasks_persona_id ON tasks(persona_id);
CREATE INDEX idx_tasks_created_at ON tasks(created_at);
CREATE INDEX idx_tasks_status_created_at ON tasks(status, created_at);
CREATE INDEX idx_tasks_priority_created_at ON tasks(priority, created_at);
```

**Drizzle schema definition:**
```ts
export const tasks = sqliteTable("tasks", {
  id:           text("id").primaryKey(),
  title:        text("title").notNull(),
  description:  text("description").notNull(),
  personaId:    text("persona_id").notNull().references(() => personas.id),
  personaName:  text("persona_name").notNull(),
  status:       text("status").notNull().default("PENDING"),
  priority:     integer("priority").notNull().default(3),
  repoPath:     text("repo_path").notNull(),
  targetFiles:  text("target_files").notNull().default("[]"),
  sessionId:    text("session_id"),
  outputLog:    text("output_log"),
  diffPath:     text("diff_path"),
  errorMessage: text("error_message"),
  reviewedBy:   text("reviewed_by"),
  reviewNote:   text("review_note"),
  startedAt:    text("started_at"),
  completedAt:  text("completed_at"),
  createdAt:    text("created_at").notNull(),
  updatedAt:    text("updated_at").notNull(),
});
```

**Status enum** (enforced at app layer, not DB constraint):
```ts
export const TaskStatus = {
  PENDING:          "PENDING",
  QUEUED:           "QUEUED",
  RUNNING:          "RUNNING",
  AWAITING_REVIEW:  "AWAITING_REVIEW",
  APPROVED:         "APPROVED",
  REJECTED:         "REJECTED",
  COMPLETE:         "COMPLETE",
  FAILED:           "FAILED",
} as const;
```

---

### `task_events` table

Append-only event log per task. Enables timeline replay and live log streaming.

```sql
CREATE TABLE task_events (
  id          TEXT PRIMARY KEY,                        -- nanoid
  task_id     TEXT NOT NULL REFERENCES tasks(id),
  event_type  TEXT NOT NULL,
  payload     TEXT NOT NULL DEFAULT '{}',              -- JSON string
  created_at  TEXT NOT NULL
);

CREATE INDEX idx_task_events_task_id ON task_events(task_id);
CREATE INDEX idx_task_events_task_id_created_at ON task_events(task_id, created_at);
```

**Drizzle schema definition:**
```ts
export const taskEvents = sqliteTable("task_events", {
  id:        text("id").primaryKey(),
  taskId:    text("task_id").notNull().references(() => tasks.id),
  eventType: text("event_type").notNull(),
  payload:   text("payload").notNull().default("{}"),
  createdAt: text("created_at").notNull(),
});
```

**`event_type` values and `payload` shapes:**

| eventType | Payload |
|-----------|---------|
| `STATUS_CHANGE` | `{ from: string, to: string }` |
| `TOOL_CALL` | `{ tool: string, input: string, output: string, durationMs: number, success: boolean }` |
| `AGENT_OUTPUT` | `{ text: string }` |
| `ERROR` | `{ message: string, stack?: string }` |
| `REVIEW_ACTION` | `{ action: "APPROVED" \| "REJECTED", reviewedBy: string, note?: string }` |

---

## Diff + Log Storage

Two strategies depending on your preference:

**Option 1 — Local filesystem (simplest for homelab)**
```
/home/aaron/.ai-dashboard/
  sessions/
    <taskId>/
      session.log
      changes.diff
```
`diff_path` and `output_log` in the `tasks` table store the absolute filesystem path. The Hono API serves these files directly via a protected `/api/tasks/:id/diff` endpoint.

**Option 2 — S3 (if you want durable cloud backup)**
Same structure as the DynamoDB version — `diff_path` stores an S3 key and the API generates a presigned URL on demand.

For a homelab-first setup, Option 1 is the pragmatic choice. You can always migrate to S3 later.

---

## Status State Machine

```
PENDING ──► QUEUED ──► RUNNING ──► AWAITING_REVIEW ──► APPROVED ──► COMPLETE
                                                    └──► REJECTED
               └──────────────────────────────────────────────────► FAILED
```

---

## Query Patterns

Since this is SQL, queries are straightforward joins and filters — no GSI planning needed.

```ts
// List active personas
db.select().from(personas).where(eq(personas.isActive, true)).orderBy(desc(personas.createdAt))

// List tasks by status, sorted by priority then age
db.select().from(tasks)
  .where(eq(tasks.status, "PENDING"))
  .orderBy(asc(tasks.priority), asc(tasks.createdAt))

// List tasks with persona join (no denormalization needed if you want fresh data)
db.select().from(tasks).leftJoin(personas, eq(tasks.personaId, personas.id))

// Task event timeline
db.select().from(taskEvents)
  .where(eq(taskEvents.taskId, taskId))
  .orderBy(asc(taskEvents.createdAt))

// Tasks for a specific persona
db.select().from(tasks)
  .where(eq(tasks.personaId, personaId))
  .orderBy(desc(tasks.createdAt))
```

---

## Migration Strategy (Drizzle)

```bash
# Generate migration from schema
pnpm drizzle-kit generate

# Apply to Turso
pnpm drizzle-kit migrate
```

```ts
// drizzle.config.ts
import { defineConfig } from "drizzle-kit";

export default defineConfig({
  schema: "./src/db/schema.ts",
  out: "./drizzle",
  dialect: "turso",
  dbCredentials: {
    url: process.env.TURSO_DATABASE_URL!,
    authToken: process.env.TURSO_AUTH_TOKEN!,
  },
});
```

---

## Dependencies

```json
{
  "@libsql/client": "^0.14.0",
  "drizzle-orm": "^0.40.0",
  "drizzle-kit": "^0.30.0",
  "nanoid": "^5.0.0"
}
```
