# ai-dashboard — Phase 2 Claude Code Handoff

## What You Are Building

Phase 2 adds **session history review** and **cost tracking** to the ai-dashboard. It is entirely additive — no Phase 1 tables, routes, or components are removed or restructured.

Reference documents (read all before writing any code):
- `.planning/02-data-model-phase2.md` — two new DB tables, aggregation query patterns, cost calculation logic
- `.planning/02-component-structure-phase2.md` — new pages, components, routes, and the one Phase 1 file that needs updating
- `.planning/01-data-model-option-b.md` — Phase 1 schema (for context on existing tables)
- `.planning/01-component-structure-option-b.md` — Phase 1 component structure (for context)

---

## Assumptions

Phase 1 is complete and working:
- `personas`, `tasks`, and `task_events` tables exist in Turso
- All Phase 1 routes, services, and frontend components are functional
- `sessionRunner.ts` runs OpenCode sessions and writes diffs/logs

---

## Phase 2 Deliverables

### 1. Database — Two New Tables

Add to `packages/server/src/db/schema.ts`:
- `modelPricing` table
- `sessionCosts` table

Both are fully defined with Drizzle schema in `data-model-phase2.md`. Add all indexes.

Then run:
```bash
pnpm db:generate
pnpm db:migrate
```

### 2. Seed Model Pricing

Create `packages/server/src/db/seed/pricing.ts`:

```ts
import { db } from "../client"
import { modelPricing } from "../schema"
import { generateId } from "../../utils/id"
import { now } from "../../utils/time"

export async function seedPricing() {
  const rates = [
    { provider: "anthropic", modelId: "claude-opus-4-5",   inputCost: 15.00, outputCost: 75.00 },
    { provider: "anthropic", modelId: "claude-sonnet-4-5", inputCost: 3.00,  outputCost: 15.00 },
    { provider: "anthropic", modelId: "claude-haiku-4-5",  inputCost: 0.80,  outputCost: 4.00  },
    { provider: "openai",    modelId: "gpt-4o",            inputCost: 2.50,  outputCost: 10.00 },
    { provider: "openai",    modelId: "gpt-4o-mini",       inputCost: 0.15,  outputCost: 0.60  },
  ]

  for (const rate of rates) {
    await db.insert(modelPricing).values({
      id: generateId(),
      ...rate,
      isActive: true,
      effectiveFrom: "2025-01-01",
      createdAt: now(),
      updatedAt: now(),
    }).onConflictDoNothing()
  }
}
```

Add a `pnpm --filter server db:seed` script to `packages/server/package.json` that calls `seedPricing()`. Run it after migration.

### 3. Cost Service

Create `packages/server/src/services/costService.ts` implementing all methods defined in `component-structure-phase2.md`:
- `writeCost()`
- `getPricing()`
- `getStats()`
- `getHistory(filters)`
- `getPersonaCosts()`
- `getTrends(period)`
- `getCostByTaskId()`

Use the exact aggregation query patterns from `data-model-phase2.md`. Format all cost values to 6 decimal places max when storing (use `parseFloat(value.toFixed(6))`).

### 4. Monitor Routes

Create `packages/server/src/routes/monitor.ts`:
```
GET /api/monitor/stats
GET /api/monitor/history      ← query params: page, pageSize, personaId, provider, from, to
GET /api/monitor/personas
GET /api/monitor/trends       ← query param: period=daily|monthly
```

Add to `packages/tasks.ts`:
```
GET /api/tasks/:id/cost
```

Mount `monitorRouter` in `src/index.ts` under `/api/monitor`.

### 5. Update `sessionRunner.ts`

This is the only Phase 1 file that needs changes. Add cost capture and recording at session end as described in `component-structure-phase2.md`.

Key implementation notes:
- Token counts come from OpenCode's SSE event stream. Listen for usage events during `event.subscribe()` and accumulate `inputTokens` and `outputTokens` totals
- Check OpenCode SDK event types — look for events with `type` containing `usage` or `tokens`; inspect `event.properties` shape at runtime if needed
- Record `startTime = Date.now()` before the session starts for `sessionDurationMs`
- If `getPricing()` returns null, log a warning and continue — do not throw or fail the task
- Write the cost record after `AWAITING_REVIEW` status is set, still inside the `try` block before `finally`

### 6. Frontend — New API Hooks

Create `packages/client/src/api/monitor.ts` with all TanStack Query hooks defined in `component-structure-phase2.md`. Use appropriate `staleTime` values per resource.

### 7. Frontend — New UI Primitives

Add to `packages/client/src/components/ui/`:
- `CostBadge.tsx` — formats USD values: show 4 decimal places for values under $0.01, 2 decimal places otherwise
- `TokenCount.tsx` — formats token counts: `6025` → `6K`, `2400000` → `2.4M`
- `StatCard.tsx` — large stat display with label, value, and optional trend indicator (up/down arrow + % change)
- `StatPill.tsx` — compact inline version of StatCard
- `DateRangePicker.tsx` — two date inputs (from/to) as a controlled component
- `Pagination.tsx` — prev/next buttons + current page indicator, emits `onChange(page: number)`

### 8. Frontend — Monitor Components

Create all components in `packages/client/src/components/monitor/` as defined in `component-structure-phase2.md`.

**`CostTrendChart` and `TokenTrendChart`** — use `recharts` `BarChart`. Install recharts: `pnpm --filter client add recharts`. Key implementation details:
- `CostTrendChart`: y-axis formatted as `$0.00`, x-axis as `MMM DD` (daily) or `MMM YYYY` (monthly)
- `TokenTrendChart`: y-axis formatted with K/M suffix
- Both charts should be responsive — wrap in `<ResponsiveContainer width="100%" height={300} />`
- Use Tailwind color tokens for bar fill (e.g. `#6366f1` for indigo)

**`SessionHistoryTable`** — implement with proper loading and empty states. Clicking a task title navigates to `/tasks/:taskId`.

### 9. Frontend — `SessionCostCard`

Create `packages/client/src/components/tasks/SessionCostCard.tsx`. Only renders when `useTaskCost(taskId)` returns a non-null result. Show model, provider, token breakdown, duration, and total cost using `CostBadge` and `TokenCount` primitives.

### 10. Frontend — `CostSummaryWidget`

Create `packages/client/src/components/tasks/CostSummaryWidget.tsx`. Uses `useMonitorStats()` hook. Shows avg cost per task and a link to `/monitor/personas`. Keep it visually compact — it sits above the task list and should not dominate the page.

### 11. Frontend — `MonitorPage`

Create `packages/client/src/pages/MonitorPage.tsx` with:
- `MonitorStatBar` at the top using `useMonitorStats()`
- Tab navigation between `/monitor/history`, `/monitor/personas`, `/monitor/trends`
- Each tab is a separate child component rendered via React Router `<Outlet />`

### 12. Update Sidebar

Add Monitor link to `packages/client/src/layouts/Sidebar.tsx`:
```
/tasks      → Task Queue
/personas   → Personas
/monitor    → Monitor        ← NEW
```

### 13. Update App Router

Add new routes to `packages/client/src/App.tsx`:
```tsx
<Route path="/monitor" element={<MonitorPage />}>
  <Route index element={<Navigate to="history" replace />} />
  <Route path="history"  element={<SessionHistoryTab />} />
  <Route path="personas" element={<PersonaCostTab />} />
  <Route path="trends"   element={<TrendsTab />} />
</Route>
```

---

## Build and Verification Order

1. Schema additions + `pnpm db:generate && pnpm db:migrate`
2. Seed pricing: `pnpm --filter server db:seed`
3. `costService.ts`
4. Monitor routes + task cost route
5. Update `sessionRunner.ts`
6. `pnpm --filter server tsc --noEmit` — fix all type errors before touching frontend
7. New UI primitives
8. Monitor components
9. `SessionCostCard` and `CostSummaryWidget`
10. `MonitorPage` + child tab components
11. Update Sidebar and App router
12. `pnpm --filter client tsc --noEmit` — fix all type errors
13. `pnpm dev` — smoke test all new routes manually

---

## Important Notes for Claude Code

- `recharts` is the only new dependency — add it only to `packages/client`, not the root or server
- All cost values in the DB are stored as `REAL` (SQLite float). Always use `parseFloat(value.toFixed(6))` before writing to avoid floating point noise
- `persona_name` is denormalized in `session_costs` intentionally — personas can be soft-deleted and their history should remain readable
- The `getTrends()` query uses SQLite's `strftime()` — this is libSQL compatible, no changes needed
- `useTaskCost(taskId)` should use `staleTime: Infinity` — once a cost record is written it never changes
- Do not add real-time polling to any monitor routes — all monitor data is historical, `staleTime: 60_000` is sufficient
- The `CostSummaryWidget` should gracefully handle the case where no sessions have completed yet (zero state: "No sessions completed yet")
- Token usage events from OpenCode's SSE stream may vary by model/provider — if token data is unavailable from the stream, fall back to `0` and log a warning rather than failing
