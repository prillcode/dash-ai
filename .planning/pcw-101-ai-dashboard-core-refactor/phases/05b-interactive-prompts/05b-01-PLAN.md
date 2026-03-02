---
phase: 05b-interactive-prompts
plan: 01
type: execute
---

<objective>
Add `autoApproveTools` and `interactive` boolean fields to the personas schema, service, and API routes.

Purpose: These two flags control how Dash AI behaves when OpenCode pauses for input — `autoApproveTools` auto-replies "always" to `permission.updated` tool approval requests; `interactive` enables surfacing agent questions to the user for manual reply (when false, `noReply: true` is used and questions are suppressed). This plan lays the data foundation; the runner and UI wiring come in 05b-02 and 05b-03.

Output: DB migration, updated schema, service, and routes — personas can be created/edited with both flags.
</objective>

<execution_context>
@~/.agents/skills/create-plans/workflows/execute-phase.md
@~/.agents/skills/create-plans/templates/summary.md
</execution_context>

<context>
@.planning/pcw-101-ai-dashboard-core-refactor/BRIEF.md
@.planning/pcw-101-ai-dashboard-core-refactor/ROADMAP.md
@packages/server/src/db/schema.ts
@packages/server/src/db/migrations/meta/_journal.json
@packages/server/src/services/personaService.ts
@packages/server/src/routes/personas.ts
</context>

<tasks>

<task type="auto">
  <name>Task 1: Add autoApproveTools and interactive columns to personas schema + migration</name>
  <files>
    packages/server/src/db/schema.ts,
    packages/server/src/db/migrations/0003_persona_interaction_flags.sql,
    packages/server/src/db/migrations/meta/_journal.json,
    packages/server/src/db/migrations/meta/0000_snapshot.json
  </files>
  <action>
    In schema.ts, add two integer columns to the `personas` table (SQLite stores booleans as 0/1):
    - `autoApproveTools` — integer, notNull, default(1) — default ON (tools auto-approved; matches current behavior since we have no handler yet)
    - `interactive` — integer, notNull, default(0) — default OFF (noReply mode; current safe default)

    Follow AGENTS.md migration rules exactly — do NOT run db:generate:
    1. Add columns to the `personas` table definition in schema.ts using `.default(1)` / `.default(0)` syntax matching existing columns.
    2. Create `packages/server/src/db/migrations/0003_persona_interaction_flags.sql`:
       ```sql
       ALTER TABLE `personas` ADD `auto_approve_tools` integer NOT NULL DEFAULT 1;
       ALTER TABLE `personas` ADD `interactive` integer NOT NULL DEFAULT 0;
       ```
    3. In `_journal.json`, add new entry: increment idx, tag = "0003_persona_interaction_flags".
    4. Update `0000_snapshot.json` to add both columns to the personas table entry.
    5. Run `pnpm db:migrate` to apply. Verify it exits 0 and existing persona rows have the new columns.
  </action>
  <verify>pnpm db:migrate exits 0 with no errors; querying an existing persona returns autoApproveTools and interactive fields</verify>
  <done>Migration applied cleanly, schema.ts has both columns, no data loss on existing personas</done>
</task>

<task type="auto">
  <name>Task 2: Update personaService and persona routes to include both flags</name>
  <files>
    packages/server/src/services/personaService.ts,
    packages/server/src/routes/personas.ts
  </files>
  <action>
    In `personaService.ts`:
    - Update `parsePersona()` (or equivalent row mapper) to include `autoApproveTools: Boolean(row.autoApproveTools)` and `interactive: Boolean(row.interactive)` — convert the integer DB values to JS booleans.
    - Update `createPersona()` input type and insert to accept `autoApproveTools?: boolean` (default true) and `interactive?: boolean` (default false).
    - Update `updatePersona()` similarly.

    In `routes/personas.ts`:
    - Update the create/update Zod schema to include:
      ```ts
      autoApproveTools: z.boolean().optional().default(true),
      interactive: z.boolean().optional().default(false),
      ```
    - Pass both through to the service layer.
    - GET responses already return the full persona object, so no route change needed there.

    Do NOT change the client TypeScript types yet — that's 05b-03.
  </action>
  <verify>
    POST /api/personas with body including autoApproveTools/interactive returns them in the response.
    GET /api/personas returns both fields on existing personas (with default values from migration).
  </verify>
  <done>Both fields flow through create/update/read in service and routes; existing personas have defaults applied</done>
</task>

<task type="auto">
  <name>Task 3: Run pnpm build and verify zero TypeScript errors</name>
  <files>none — verification only</files>
  <action>
    Run `pnpm build` from the repo root. Fix any TypeScript errors introduced by the schema/service/route changes. Common issues to watch for:
    - If the Persona type is inferred from the Drizzle schema, the new columns will appear automatically — ensure parsePersona maps them correctly.
    - If there's an explicit Persona interface in shared types, add the two fields there.
  </action>
  <verify>pnpm build exits 0 with zero TypeScript errors in both server and client packages</verify>
  <done>Clean build, no errors</done>
</task>

</tasks>

<verification>
- [ ] `pnpm db:migrate` exits 0
- [ ] `pnpm build` exits 0 with zero errors
- [ ] GET /api/personas returns autoApproveTools and interactive on all personas
- [ ] POST /api/personas with both fields echoes them back correctly
- [ ] Existing personas default to autoApproveTools=true, interactive=false
</verification>

<success_criteria>
- Migration applied, both columns exist in SQLite personas table
- Service layer converts DB integers to JS booleans correctly
- Routes accept and return both flags
- pnpm build passes clean
- No existing persona data affected
</success_criteria>

<output>
After completion, create `.planning/pcw-101-ai-dashboard-core-refactor/phases/05b-interactive-prompts/05b-01-SUMMARY.md`:

# Phase 05B Plan 01: Persona Interaction Flags — Summary

**[One-liner: what shipped]**

## Accomplishments
- [outcome 1]
- [outcome 2]

## Files Created/Modified
- `packages/server/src/db/schema.ts` — added autoApproveTools, interactive columns
- `packages/server/src/db/migrations/0003_persona_interaction_flags.sql` — migration
- `packages/server/src/db/migrations/meta/_journal.json` — updated
- `packages/server/src/db/migrations/meta/0000_snapshot.json` — updated
- `packages/server/src/services/personaService.ts` — parse + CRUD updated
- `packages/server/src/routes/personas.ts` — Zod schema updated

## Decisions Made
[or "None"]

## Issues Encountered
[or "None"]

## Next Step
Ready for 05b-02-PLAN.md
</output>
