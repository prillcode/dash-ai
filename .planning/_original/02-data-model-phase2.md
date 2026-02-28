# ai-dashboard — Phase 2 Data Model Additions

**Phase 2 scope:** Session history review + cost tracking (per session, per persona, daily/monthly totals)  
**Stack:** Same as Phase 1 — Turso/libSQL via Drizzle ORM  
**Approach:** Additive only — no Phase 1 schema changes required

---

## Design Decisions

- Costs are **calculated and stored at session end** by `sessionRunner.ts` — no runtime calculation in the frontend
- Token counts are stored alongside calculated costs so pricing can be recalculated later if model rates change
- **Provider pricing is stored in the DB** (`model_pricing` table) so it can be updated without a code deploy when providers change rates
- Rollups (per persona, daily/monthly totals) are computed via SQL aggregation queries — no separate rollup tables needed at this scale
- Multi-provider support: each cost record stores `provider` and `model` so costs are attributable regardless of which provider ran the session

---

## New Tables

### `model_pricing` table

Stores per-model pricing rates. Seeded with known rates at migration time, updated manually as providers change pricing.

```sql
CREATE TABLE model_pricing (
  id           TEXT PRIMARY KEY,               -- nanoid
  provider     TEXT NOT NULL,                  -- e.g. "anthropic", "openai"
  model_id     TEXT NOT NULL,                  -- e.g. "claude-sonnet-4-5", "gpt-4o"
  input_cost   REAL NOT NULL,                  -- cost per 1M input tokens (USD)
  output_cost  REAL NOT NULL,                  -- cost per 1M output tokens (USD)
  is_active    INTEGER NOT NULL DEFAULT 1,     -- 0 = outdated rate, 1 = current
  effective_from TEXT NOT NULL,                -- ISO 8601 date this rate took effect
  created_at   TEXT NOT NULL,
  updated_at   TEXT NOT NULL
);

CREATE UNIQUE INDEX idx_model_pricing_provider_model 
  ON model_pricing(provider, model_id, effective_from);
CREATE INDEX idx_model_pricing_active 
  ON model_pricing(is_active);
```

**Drizzle schema:**
```ts
export const modelPricing = sqliteTable("model_pricing", {
  id:            text("id").primaryKey(),
  provider:      text("provider").notNull(),
  modelId:       text("model_id").notNull(),
  inputCost:     real("input_cost").notNull(),     // per 1M tokens
  outputCost:    real("output_cost").notNull(),    // per 1M tokens
  isActive:      integer("is_active", { mode: "boolean" }).notNull().default(true),
  effectiveFrom: text("effective_from").notNull(),
  createdAt:     text("created_at").notNull(),
  updatedAt:     text("updated_at").notNull(),
});
```

**Seed data (include in initial Phase 2 migration):**
```ts
// Approximate rates as of early 2026 — update as needed
const pricingSeed = [
  { provider: "anthropic", modelId: "claude-opus-4-5",    inputCost: 15.00, outputCost: 75.00 },
  { provider: "anthropic", modelId: "claude-sonnet-4-5",  inputCost: 3.00,  outputCost: 15.00 },
  { provider: "anthropic", modelId: "claude-haiku-4-5",   inputCost: 0.80,  outputCost: 4.00  },
  { provider: "openai",    modelId: "gpt-4o",             inputCost: 2.50,  outputCost: 10.00 },
  { provider: "openai",    modelId: "gpt-4o-mini",        inputCost: 0.15,  outputCost: 0.60  },
]
```

---

### `session_costs` table

One record per completed task session. Written by `sessionRunner.ts` at session end.

```sql
CREATE TABLE session_costs (
  id              TEXT PRIMARY KEY,             -- nanoid
  task_id         TEXT NOT NULL REFERENCES tasks(id),
  persona_id      TEXT NOT NULL REFERENCES personas(id),
  persona_name    TEXT NOT NULL,                -- denormalized for history (persona may be deleted later)
  provider        TEXT NOT NULL,                -- e.g. "anthropic"
  model_id        TEXT NOT NULL,                -- e.g. "claude-sonnet-4-5"
  input_tokens    INTEGER NOT NULL DEFAULT 0,
  output_tokens   INTEGER NOT NULL DEFAULT 0,
  total_tokens    INTEGER NOT NULL DEFAULT 0,
  input_cost      REAL NOT NULL DEFAULT 0,      -- USD, calculated at session end
  output_cost     REAL NOT NULL DEFAULT 0,      -- USD
  total_cost      REAL NOT NULL DEFAULT 0,      -- USD
  session_duration_ms INTEGER,                  -- wall clock time for the session
  recorded_at     TEXT NOT NULL                 -- ISO 8601 — when this record was written
);

CREATE INDEX idx_session_costs_task_id      ON session_costs(task_id);
CREATE INDEX idx_session_costs_persona_id   ON session_costs(persona_id);
CREATE INDEX idx_session_costs_recorded_at  ON session_costs(recorded_at);
CREATE INDEX idx_session_costs_provider     ON session_costs(provider);
```

**Drizzle schema:**
```ts
export const sessionCosts = sqliteTable("session_costs", {
  id:                text("id").primaryKey(),
  taskId:            text("task_id").notNull().references(() => tasks.id),
  personaId:         text("persona_id").notNull().references(() => personas.id),
  personaName:       text("persona_name").notNull(),
  provider:          text("provider").notNull(),
  modelId:           text("model_id").notNull(),
  inputTokens:       integer("input_tokens").notNull().default(0),
  outputTokens:      integer("output_tokens").notNull().default(0),
  totalTokens:       integer("total_tokens").notNull().default(0),
  inputCost:         real("input_cost").notNull().default(0),
  outputCost:        real("output_cost").notNull().default(0),
  totalCost:         real("total_cost").notNull().default(0),
  sessionDurationMs: integer("session_duration_ms"),
  recordedAt:        text("recorded_at").notNull(),
});
```

**Example row:**
```json
{
  "id": "sc_abc123",
  "task_id": "t_xyz789",
  "persona_id": "p_abc123",
  "persona_name": "Implementer",
  "provider": "anthropic",
  "model_id": "claude-sonnet-4-5",
  "input_tokens": 4821,
  "output_tokens": 1204,
  "total_tokens": 6025,
  "input_cost": 0.014463,
  "output_cost": 0.018060,
  "total_cost": 0.032523,
  "session_duration_ms": 162000,
  "recorded_at": "2025-02-18T10:07:42Z"
}
```

---

## Cost Calculation Logic

Performed in `sessionRunner.ts` at session end, before writing the `session_costs` record:

```ts
function calculateCost(
  inputTokens: number,
  outputTokens: number,
  pricing: { inputCost: number; outputCost: number }  // rates per 1M tokens
): { inputCost: number; outputCost: number; totalCost: number } {
  const inputCost  = (inputTokens  / 1_000_000) * pricing.inputCost
  const outputCost = (outputTokens / 1_000_000) * pricing.outputCost
  return { inputCost, outputCost, totalCost: inputCost + outputCost }
}
```

If no pricing record exists for the model, store `0` for costs and log a warning — don't fail the session.

---

## Aggregation Query Patterns

All rollup data is computed via SQL — no separate summary tables needed.

**Cost by persona (all time):**
```ts
db.select({
  personaId:   sessionCosts.personaId,
  personaName: sessionCosts.personaName,
  totalCost:   sum(sessionCosts.totalCost),
  totalTokens: sum(sessionCosts.totalTokens),
  sessionCount: count(sessionCosts.id),
  avgCostPerSession: sql<number>`avg(${sessionCosts.totalCost})`,
})
.from(sessionCosts)
.groupBy(sessionCosts.personaId, sessionCosts.personaName)
.orderBy(desc(sum(sessionCosts.totalCost)))
```

**Daily totals (last 30 days):**
```ts
db.select({
  day:        sql<string>`date(${sessionCosts.recordedAt})`,
  totalCost:  sum(sessionCosts.totalCost),
  totalTokens: sum(sessionCosts.totalTokens),
  sessionCount: count(sessionCosts.id),
})
.from(sessionCosts)
.where(gte(sessionCosts.recordedAt, thirtyDaysAgo))
.groupBy(sql`date(${sessionCosts.recordedAt})`)
.orderBy(sql`date(${sessionCosts.recordedAt})`)
```

**Monthly totals:**
```ts
db.select({
  month:       sql<string>`strftime('%Y-%m', ${sessionCosts.recordedAt})`,
  totalCost:   sum(sessionCosts.totalCost),
  totalTokens: sum(sessionCosts.totalTokens),
  sessionCount: count(sessionCosts.id),
})
.from(sessionCosts)
.groupBy(sql`strftime('%Y-%m', ${sessionCosts.recordedAt})`)
.orderBy(sql`strftime('%Y-%m', ${sessionCosts.recordedAt})`)
```

**Cost per task average (overall):**
```ts
db.select({
  avgCost:    sql<number>`avg(${sessionCosts.totalCost})`,
  avgTokens:  sql<number>`avg(${sessionCosts.totalTokens})`,
})
.from(sessionCosts)
```

**Session history (paginated, most recent first):**
```ts
db.select({
  ...sessionCosts,
  taskTitle: tasks.title,
})
.from(sessionCosts)
.leftJoin(tasks, eq(sessionCosts.taskId, tasks.id))
.orderBy(desc(sessionCosts.recordedAt))
.limit(pageSize)
.offset(page * pageSize)
```

---

## Phase 1 Schema Modifications

None required. The new tables reference existing `tasks` and `personas` tables via foreign keys but add no columns to them.

The only Phase 1 **code** change needed is in `sessionRunner.ts` — add cost capture and `session_costs` record writing at session end (see Phase 2 handoff doc).

---

## Dependencies Added

No new DB dependencies — same `drizzle-orm` and `@libsql/client` from Phase 1.
