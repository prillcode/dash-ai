# DA-01 — Pi SDK + Electron Migration

## Type
Refactor

## Objective
Replace the OpenCode CLI integration with the Pi SDK (`@mariozechner/pi-coding-agent`) for agent execution, adopt pi-native skills (`start-work-begin`, `start-work-plan`, `start-work-run`) for the planning and coding workflow, and package Dash AI as an Electron desktop app. This eliminates external dependencies (opencode-cli, gnome-terminal, npx @prillcode/start-work), enables cross-platform support, and unlocks rich real-time event streaming from AI sessions to the UI.

## Background
Dash AI currently spawns `opencode-cli run` inside `gnome-terminal` windows for planning and coding sessions. The planning phase invokes two external CLI-installed skills (`start-work` + `create-plans`) which produce `.planning/` scaffolds. The coding phase sends a flat task description prompt. This approach:
- Is Linux/GNOME-only
- Provides no programmatic event streaming (only heartbeat polling while waiting for process exit)
- Requires users to install and configure OpenCode separately
- Requires a separate `npx @prillcode/start-work` step to install skills
- Cannot show real-time agent activity in the dashboard UI
- Coding phase has no structured execution framework — just a raw prompt

Pi's SDK provides `createAgentSession()` — a fully programmatic API with event subscriptions (`message_update`, `tool_execution_start/end`, `tool_call`, `agent_end`), built-in auth management, model registry, skill discovery, and session management. Pi also natively discovers skills from `~/.agents/skills/`, which is where the pi-native skill stack already lives.

The pi-native skill stack replaces the CLI-installed equivalents with richer, pi-optimized versions:
- `start-work-begin` → replaces `start-work` (scaffolds BRIEF.md, ROADMAP.md, phase stubs)
- `start-work-plan` → replaces `create-plans` (deepens phases into executable PLAN.md files)
- `start-work-run` → replaces the flat coding prompt (walks through multiple phase plans sequentially with verification steps and checkpoints)

Packaging as Electron gives us a single-install desktop app where the Hono server runs in the main process, the React UI in a BrowserWindow, and agent sessions are managed entirely in-process with IPC replacing WebSocket.

## Scope
- Replace `planningRunner.ts` with Pi SDK session-based planning using `/skill:start-work-begin` + `/skill:start-work-plan`
- Replace `codingRunner.ts` with Pi SDK session-based coding using `/skill:start-work-run`
- Replace `authCheck.ts` with Pi `AuthStorage` + `ModelRegistry`
- Update `queueWorker.ts` to manage in-process Pi sessions instead of spawning terminals
- Replace CLI-installed skill dependency (`npx @prillcode/start-work`) with pi-native skill stack (`~/.agents/skills/`)
- Create Electron main process shell (BrowserWindow + Hono server)
- Replace WebSocket layer with Electron IPC
- Update persona model to leverage Pi's model registry
- Package as distributable Electron app (macOS, Linux, Windows)
- Update frontend to consume structured agent events (tool calls, thinking, text deltas)

## Out of Scope
- Pi extension/plugin system (Dash AI uses the SDK, not extensions)
- Interactive prompt passthrough (deferred — Phase 05B from pcw-101)
- Config menu / models DB table (deferred — Phase 07 from pcw-101)
- Tests (can be added incrementally after migration)
- Auto-update mechanism for Electron app
- Code signing / notarization for distribution
- Dash AI-specific skill customizations (use skills as-is, tune later)

## Relevant Files
- `packages/server/src/agent/planningRunner.ts` — rewrite with Pi SDK
- `packages/server/src/agent/codingRunner.ts` — rewrite with Pi SDK
- `packages/server/src/agent/authCheck.ts` — rewrite with Pi AuthStorage
- `packages/server/src/agent/sessionRunner.ts` — simplify/remove
- `packages/server/src/services/queueWorker.ts` — adapt for Pi sessions
- `packages/server/src/db/schema.ts` — update persona model fields
- `packages/server/src/routes/models.ts` — use Pi ModelRegistry
- `packages/server/src/index.ts` — Electron main process entry
- `packages/client/src/api/tasks.ts` — consume structured events
- `packages/client/src/components/tasks/TaskTimelinePanel.tsx` — render agent activity
- `packages/client/src/components/diff/DiffReviewPanel.tsx` — no changes expected
- `packages/server/src/ws/taskStream.ts` — replace with IPC or remove
- `packages/server/src/middleware/auth.ts` — simplify for local Electron use

## Context
- Branch: `main` (planning only — branch created before execution)
- Source plan: Analysis from conversation session on 2026-04-18
- Related work: `pcw-101` (core refactor, mostly complete through Phase 05)

## Skill Integration Flow

```
User creates task (DRAFT)
    │
    ▼
Planning session (IN_PLANNING)
    ├─ Pi session loads /skill:start-work-begin
    │   └─ scaffolds BRIEF.md + ROADMAP.md + phase stubs in .planning/
    ├─ Pi session loads /skill:start-work-plan
    │   └─ expands each phase into detailed PLAN.md files
    │
    ▼
User reviews in dashboard (PLANNED)
    ├─ reads BRIEF.md, ROADMAP.md in plan doc viewer
    ├─ clicks "Iterate Plan" with feedback → back to IN_PLANNING
    │   └─ /skill:start-work-plan refines targeted phases with feedback
    ├─ clicks "Mark Ready to Code" → READY_TO_CODE
    │
    ▼
Coding session (RUNNING)
    ├─ Pi session loads /skill:start-work-run
    │   └─ walks through all phase plans sequentially
    │   └─ each plan has verification steps + checkpoint summaries
    │
    ▼
User reviews diff (AWAITING_REVIEW → APPROVED/REJECTED)
```

## Success Criteria
- [ ] `pnpm build` passes with zero TypeScript errors
- [ ] Planning sessions run via Pi SDK using `/skill:start-work-begin` + `/skill:start-work-plan`
- [ ] Coding sessions run via Pi SDK using `/skill:start-work-run` with full tool access
- [ ] No dependency on `opencode-cli`, `gnome-terminal`, `@opencode-ai/sdk`, or `npx @prillcode/start-work`
- [ ] Skills discovered natively from `~/.agents/skills/` (Pi's built-in discovery)
- [ ] Real-time agent events stream to the UI (tool calls, text output, thinking)
- [ ] Auth works via Pi's AuthStorage (env vars, `~/.pi/agent/auth.json`, OAuth)
- [ ] Persona model/provider selection uses Pi's ModelRegistry
- [ ] Electron app launches with React UI and runs agent sessions in-process
- [ ] Works on at least Linux and macOS
