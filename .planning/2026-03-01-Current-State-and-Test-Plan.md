# Dash AI — Phase 04 Workflow Test Handoff

**Date:** 2026-03-01  
**Status:** Phase 04 complete, build clean, ready for workflow test before Phase 05

---

## Project

Dash AI — self-hosted AI agent dashboard. Monorepo at `/home/prill/dev/ai-dashboard`. Hono backend + React frontend. Run with `pnpm dev` (server on :3000, client on :5173 proxied).

---

## What Was Just Completed

All Phase 01–04 work is done and committed. The last thing completed was a full audit and fix of the OpenCode SDK integration. The codebase is clean — `pnpm build` passes with zero TypeScript errors.

---

## OpenCode SDK Integration Summary

The SDK (`@opencode-ai/sdk`, always installed via `pnpm install`) is used in two runners:

**`packages/server/src/opencode/planningRunner.ts`** — handles `IN_PLANNING` tasks  
**`packages/server/src/opencode/codingRunner.ts`** — handles `RUNNING` tasks  

Full reference doc: `packages/server/OpenCode-SDK-Integration.md`

Both runners follow the same pattern:

```
createOpencode({ config: {} })           → spawns local OpenCode server, returns { client }
client.session.create({ query: { directory: repoPath }, body: { title } })
  → createResult.data.id                 → sessionId

client.session.prompt({ path: { id: sessionId }, body: { model: { providerID, modelID }, agent, system, parts } })
  → check promptResult.error

client.event.subscribe({ query: { directory: repoPath } })
  → for await (const raw of eventResult.stream)   ← .stream is the AsyncGenerator
  → filter: props.sessionID === sessionId
  → complete on: type === "session.idle" OR type === "session.status" && props.status.type === "idle"
  → error on:   type === "session.error"

client.session.diff({ path: { id: sessionId } })
  → diffResult.data                      → Array<{ file, before, after, additions, deletions }>
```

**Key facts:**
- `model` must be `{ providerID: string, modelID: string }` — NOT a string. `normalizeModel()` in `planningRunner.ts` handles conversion from the DB's stored string format.
- `client.event.subscribe()` returns `{ stream: AsyncGenerator }` — iterate `.stream`, not the result itself.
- Do NOT call `server.close()` — it kills the OpenCode process and breaks concurrent tasks.
- OpenCode reads provider credentials from `~/.local/share/opencode/auth.json` (set via OpenCode TUI `/connect`) or from env vars (`ANTHROPIC_API_KEY`, etc.).

### Known Unverified Assumptions

These need to be discovered during the test below:

- Whether `agent: "plan"` and `agent: "build"` are valid agent names in this version of OpenCode
- Whether `createOpencode()` per-task (spawning a new server per session) works, or if a single shared instance is needed
- Whether the planning agent actually writes plan docs to `.planning/` in the repo

---

## Current DB State

| Thing | Value |
|---|---|
| Persona | **Probi** — `anthropic/claude-sonnet-4-6` — use as planning persona |
| Persona | **Codi** — `deepseek/deepseek-reasoner` — use as coding persona |
| Project | **ClawDock** → `~/dev/clawdock` |
| Tasks | One `FAILED` task — ignore it |

---

## UI Steps to Test the Full Planning Workflow

### Prerequisites
- `pnpm dev` running (both server and client)
- OpenCode credentials configured (`~/.local/share/opencode/auth.json` has Anthropic key, or `ANTHROPIC_API_KEY` is set in `.env`)

### Step 1 — Create a task
1. Open `http://localhost:5173/tasks`
2. Click **New Task**
3. Fill in:
   - Title: `Test Planning Workflow`
   - Description: `Create a simple hello world CLI script in the clawdock repo`
   - Project: `ClawDock`
   - Planning Persona: `Probi`
   - Coding Persona: `Codi`
4. Submit — task should appear with status `DRAFT`

### Step 2 — Trigger planning
The UI doesn't have a Start Planning button yet (that's Phase 05). Trigger via curl:

```bash
TASK_ID=<id from the task list>
curl -s -X POST http://localhost:3000/api/tasks/$TASK_ID/start-planning \
  -H "Authorization: Bearer $(grep API_TOKEN /home/prill/dev/ai-dashboard/.env | head -1 | cut -d= -f2)"
```

Task status should change to `IN_PLANNING`. The queue worker picks it up within 2 seconds.

### Step 3 — Watch server logs
In the `pnpm dev` terminal, watch for `packages/server dev:` lines. Expected sequence:

```
PLANNING_EVENT: starting
PLANNING_EVENT: creating_session
PLANNING_EVENT: session_created
PLANNING_EVENT: sending_prompt
PLANNING_EVENT: prompt_sent
... (session.status / other events streaming in)
PLANNING_EVENT: session.idle   ← completion signal
PLANNING_EVENT: completed
```

### Step 4 — Check task status
```bash
curl -s http://localhost:3000/api/tasks/$TASK_ID \
  -H "Authorization: Bearer $(grep API_TOKEN /home/prill/dev/ai-dashboard/.env | head -1 | cut -d= -f2)" \
  | python3 -m json.tool | grep -E "status|planPath"
```

Expected: `"status": "PLANNED"` and `planPath` set to the plan subdirectory.

### Step 5 — Check plan docs were written
```bash
ls ~/dev/clawdock/.planning/
```

Should contain a subdirectory with `BRIEF.md`, `ROADMAP.md`, etc. written by the OpenCode planning agent.

### Step 6 — Check events were recorded
```bash
curl -s http://localhost:3000/api/tasks/$TASK_ID/events \
  -H "Authorization: Bearer $(grep API_TOKEN /home/prill/dev/ai-dashboard/.env | head -1 | cut -d= -f2)" \
  | python3 -m json.tool
```

---

## What Comes Next

After the test passes (or issues are debugged and fixed), proceed to **Phase 05 — Planning UI**.

Three plans already written and ready to execute in order:

| Plan | Description |
|---|---|
| `05-01` | Planning API hooks + dual-persona dropdowns in TaskForm + PlanningSection stub |
| `05-02` | PlanDocViewer markdown rendering + Start Planning / Mark Ready to Code buttons |
| `05-03` | IteratePlanForm + human verification checkpoint |

Plans are at: `.planning/pcw-101-ai-dashboard-core-refactor/phases/05-planning-ui/`

### Commit Convention
```
feat(pcw-101-05-01): <description>
fix(pcw-101-XX): <description>
```
