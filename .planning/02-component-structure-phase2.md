# ai-dashboard — Phase 2 Component Structure

**Phase 2 scope:** Session history review + cost tracking  
**Approach:** Additive — new routes, pages, and components only. No Phase 1 component changes except one widget addition to `TaskQueuePage`.

---

## New Routes

```
/monitor                   → MonitorPage (default tab: Session History)
/monitor/history           → MonitorPage (Session History tab)
/monitor/personas          → MonitorPage (Cost by Persona tab)
/monitor/trends            → MonitorPage (Trends tab)
```

`MonitorPage` uses tab-based navigation so all views live under a single page component with a shared header and stats bar.

---

## Updated Route Map (full)

```
/                          → redirect → /tasks
/tasks                     → TaskQueuePage           ← adds CostSummaryWidget (Phase 2)
/tasks/new                 → TaskCreatePage
/tasks/:taskId             → TaskDetailPage           ← adds SessionCostCard (Phase 2)
/personas                  → PersonaListPage
/personas/new              → PersonaFormPage
/personas/:personaId       → PersonaFormPage
/monitor                   → MonitorPage (new)
/monitor/history           → MonitorPage/HistoryTab (new)
/monitor/personas          → MonitorPage/PersonasTab (new)
/monitor/trends            → MonitorPage/TrendsTab (new)
```

---

## New Page: `MonitorPage`

```
<MonitorPage>
  <PageHeader title="Monitor" />

  <MonitorStatBar>              ← top-line stats across all time
    <StatCard label="Total Spent" value="$12.40" />
    <StatCard label="Avg Cost / Task" value="$0.18" />
    <StatCard label="Total Sessions" value="68" />
    <StatCard label="Total Tokens" value="2.4M" />
  </MonitorStatBar>

  <MonitorTabs>                 ← tab bar with 3 views
    <Tab href="/monitor/history">Session History</Tab>
    <Tab href="/monitor/personas">By Persona</Tab>
    <Tab href="/monitor/trends">Trends</Tab>
  </MonitorTabs>

  <Outlet />                    ← renders active tab content
</MonitorPage>
```

---

### Tab 1: Session History (`/monitor/history`)

Paginated table of all completed sessions with cost data. Most recent first.

```
<SessionHistoryTab>
  <SessionHistoryFilters>
    <PersonaSelector />           ← filter by persona
    <DateRangePicker />           ← filter by date range
    <ProviderFilter />            ← filter by provider (Anthropic, OpenAI, etc.)
  </SessionHistoryFilters>

  <SessionHistoryTable>
    <thead>
      Task | Persona | Model | Input Tokens | Output Tokens | Total Cost | Duration | Date
    </thead>
    <tbody>
      <SessionHistoryRow />       ← repeated, links to /tasks/:taskId
      ...
    </tbody>
  </SessionHistoryTable>

  <Pagination />
</SessionHistoryTab>
```

`SessionHistoryRow` links the task title to `/tasks/:taskId` so the user can jump to the full task detail from the history view.

---

### Tab 2: Cost by Persona (`/monitor/personas`)

```
<PersonaCostTab>
  <PersonaCostTable>
    <thead>
      Persona | Sessions | Total Tokens | Total Cost | Avg Cost / Session
    </thead>
    <tbody>
      <PersonaCostRow />           ← one row per persona, sorted by total cost desc
      ...
    </tbody>
  </PersonaCostTable>

  <PersonaCostBreakdown>          ← shown when a row is selected/expanded
    <ModelUsageList />             ← which models this persona used + cost per model
  </PersonaCostBreakdown>
</PersonaCostTab>
```

---

### Tab 3: Trends (`/monitor/trends`)

```
<TrendsTab>
  <TrendsPeriodToggle />           ← Daily | Monthly

  <CostTrendChart />               ← bar chart: cost per day or per month
                                      x-axis: date, y-axis: USD
                                      rendered with recharts

  <TokenTrendChart />              ← bar chart: tokens per day or month

  <MonthlySummaryTable>            ← table below the charts
    <thead>
      Period | Sessions | Input Tokens | Output Tokens | Total Cost
    </thead>
    <tbody>
      <MonthlySummaryRow />
      ...
    </tbody>
  </MonthlySummaryTable>
</TrendsTab>
```

---

## Updated Page: `TaskQueuePage`

Add a `CostSummaryWidget` between the `PageHeader` and `TaskStatusTabs`:

```
<TaskQueuePage>
  <PageHeader title="Task Queue">
    <Button href="/tasks/new">New Task</Button>
  </PageHeader>

  <CostSummaryWidget />           ← NEW in Phase 2

  <TaskStatusTabs> ... </TaskStatusTabs>
  <TaskList> ... </TaskList>
</TaskQueuePage>
```

**`<CostSummaryWidget />`** — compact two-stat row, links to `/monitor`:

```
<CostSummaryWidget>
  <StatPill label="Avg Cost / Task" value="$0.18" />
  <StatPill label="Cost by Persona" linkTo="/monitor/personas" />
  <Link href="/monitor">View full monitor →</Link>
</CostSummaryWidget>
```

---

## Updated Page: `TaskDetailPage`

Add `SessionCostCard` to the left column below `TaskMetaCard`:

```
<TwoColumnLayout>
  <left>
    <TaskMetaCard />
    <SessionCostCard />           ← NEW in Phase 2 (only renders if task is COMPLETE)
    <TaskTimelinePanel />
  </left>
  <right>
    <DiffReviewPanel />
  </right>
</TwoColumnLayout>
```

**`<SessionCostCard />`:**
```
<SessionCostCard>
  <div>Model: claude-sonnet-4-5 (Anthropic)</div>
  <div>Input tokens: 4,821 / Output tokens: 1,204</div>
  <div>Duration: 2m 42s</div>
  <div class="total">Total cost: $0.0325</div>
</SessionCostCard>
```

Only rendered when a `session_costs` record exists for the task.

---

## New Shared Components

### `<CostBadge value={0.032} />`
Formatted cost display: `$0.03` for small amounts, `$1.24` for larger. Used inline in tables and cards.

### `<TokenCount value={6025} />`
Formatted token display with K/M suffix: `6,025` → `6K`, `2,400,000` → `2.4M`.

### `<StatCard label="" value="" />`
Large stat display used in `MonitorStatBar`. Optional `trend` prop for up/down indicator.

### `<StatPill label="" value="" />`
Compact inline stat used in `CostSummaryWidget`.

### `<CostTrendChart data={[]} />`
Recharts `BarChart` wrapper. Accepts `{ date: string, totalCost: number }[]`. Formats y-axis as USD, x-axis as `MMM DD` or `MMM YYYY` depending on period toggle.

### `<TokenTrendChart data={[]} />`
Same as `CostTrendChart` but y-axis is token count with K/M formatting.

### `<DateRangePicker />`
Two date inputs (from/to) used in `SessionHistoryFilters`. Controlled component, emits `{ from: string, to: string }`.

### `<Pagination currentPage={} totalPages={} onChange={} />`
Simple prev/next + page number buttons used in `SessionHistoryTab`.

---

## New API Hooks (TanStack Query)

```ts
// Monitor stats — top-line numbers
useMonitorStats()
  → GET /api/monitor/stats
  → { totalCost, avgCostPerTask, totalSessions, totalTokens }
  → staleTime: 60_000

// Session history — paginated
useSessionHistory({ page, personaId?, provider?, from?, to? })
  → GET /api/monitor/history?page=&personaId=&provider=&from=&to=
  → { rows: SessionHistoryRow[], total: number, pageSize: number }
  → staleTime: 30_000

// Cost by persona
usePersonaCosts()
  → GET /api/monitor/personas
  → PersonaCostRow[]
  → staleTime: 60_000

// Trends
useCostTrends(period: "daily" | "monthly")
  → GET /api/monitor/trends?period=daily|monthly
  → { costs: TrendPoint[], tokens: TrendPoint[] }
  → staleTime: 60_000

// Single task cost (for TaskDetailPage)
useTaskCost(taskId)
  → GET /api/tasks/:id/cost
  → SessionCost | null
  → staleTime: Infinity  (immutable once written)
```

---

## New Backend Routes

**`routes/monitor.ts`**
```
GET /api/monitor/stats          → overall totals
GET /api/monitor/history        → paginated session history with joins
GET /api/monitor/personas       → cost grouped by persona
GET /api/monitor/trends         → daily or monthly aggregations
```

**Addition to `routes/tasks.ts`**
```
GET /api/tasks/:id/cost         → get session_costs record for a task
```

---

## New Backend Service

**`services/costService.ts`**

Handles all `session_costs` and `model_pricing` DB interactions:

```ts
// Called by sessionRunner.ts at session end
writeCost(data: NewSessionCost): Promise<SessionCost>

// Looks up current pricing for a model — returns null if not found
getPricing(provider: string, modelId: string): Promise<ModelPricing | null>

// Monitor aggregation queries
getStats(): Promise<MonitorStats>
getHistory(filters): Promise<{ rows: SessionHistoryRow[], total: number }>
getPersonaCosts(): Promise<PersonaCostRow[]>
getTrends(period: "daily" | "monthly"): Promise<TrendData>

// For TaskDetailPage
getCostByTaskId(taskId: string): Promise<SessionCost | null>
```

---

## Phase 1 Code Changes

Only one file needs updating in Phase 1 code:

**`packages/server/src/opencode/sessionRunner.ts`** — add at session end:

```ts
// After session completes, before server.close()
const pricing = await costService.getPricing(provider, modelId)

if (pricing) {
  const costs = calculateCost(inputTokens, outputTokens, pricing)
  await costService.writeCost({
    taskId: task.id,
    personaId: task.personaId,
    personaName: task.personaName,
    provider,
    modelId,
    inputTokens,
    outputTokens,
    totalTokens: inputTokens + outputTokens,
    ...costs,
    sessionDurationMs: Date.now() - startTime,
    recordedAt: now(),
  })
} else {
  console.warn(`No pricing found for ${provider}/${modelId} — cost not recorded`)
}
```

Token counts come from OpenCode's event stream — the `event.subscribe()` stream emits usage events that include token counts. Parse these during the session and accumulate totals.

---

## Updated Folder Structure

Additions to Phase 1 structure (new files only):

```
packages/server/src/
  routes/
    monitor.ts                  ← NEW
  services/
    costService.ts              ← NEW
  db/
    schema.ts                   ← ADD modelPricing + sessionCosts tables
    seed/
      pricing.ts                ← NEW — seed data for model_pricing

packages/client/src/
  api/
    monitor.ts                  ← NEW TanStack Query hooks
  components/
    monitor/                    ← NEW
      MonitorStatBar.tsx
      SessionHistoryTable.tsx
      SessionHistoryRow.tsx
      SessionHistoryFilters.tsx
      PersonaCostTable.tsx
      PersonaCostRow.tsx
      TrendsTab.tsx
      CostTrendChart.tsx
      TokenTrendChart.tsx
      MonthlySummaryTable.tsx
    ui/
      CostBadge.tsx             ← NEW
      TokenCount.tsx            ← NEW
      StatCard.tsx              ← NEW
      StatPill.tsx              ← NEW
      DateRangePicker.tsx       ← NEW
      Pagination.tsx            ← NEW
    tasks/
      SessionCostCard.tsx       ← NEW
  pages/
    MonitorPage.tsx             ← NEW
```

---

## New Client Dependencies

Add to `packages/client/package.json`:
```json
{
  "recharts": "^2.0.0"
}
```

No new server dependencies.
