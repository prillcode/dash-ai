# Roadmap — DA-01 Pi SDK + Electron Migration

> **Sequencing note:** DA-01 Phases 01-02 are executed first, then DA-02 (CLI) takes
> priority. DA-01 Phases 03-05 resume after DA-02 is complete. The CLI is the headless
> engine; the Electron app is the GUI wrapper around that same engine.
>
> **Execution order:**
> ```
> DA-01 Phase 01 → DA-01 Phase 02 → DA-02 (full) → DA-01 Phase 03 → DA-01 Phase 04 → DA-01 Phase 05
> ```

---

## Phase 01 — Pi SDK Runner Rewrite
**Objective:** Replace OpenCode CLI integration with Pi SDK for planning and coding sessions, using pi-native skills
**Status:** 📋 Planned
**Outputs:**
- `planningRunner.ts` rewritten using `createAgentSession()` — invokes `/skill:start-work-begin` + `/skill:start-work-plan`
- `codingRunner.ts` rewritten using `createAgentSession()` — invokes `/skill:start-work-run`
- `authCheck.ts` replaced with Pi `AuthStorage` + `ModelRegistry`
- `queueWorker.ts` updated to manage in-process Pi sessions
- `sessionRunner.ts` simplified or removed
- Remove `@opencode-ai/sdk` and `npx @prillcode/start-work` dependencies
- Skills discovered natively by Pi from `~/.agents/skills/`
- All existing task state transitions work unchanged

## Phase 02 — Persona & Model Registry Integration
**Objective:** Wire persona configuration into Pi's model/auth system
**Status:** 📋 Planned
**Outputs:**
- Persona model/provider fields validated against Pi's `ModelRegistry`
- `GET /api/models` endpoint backed by Pi's available models
- Auth pre-flight uses Pi `AuthStorage` instead of reading opencode's `auth.json`
- Models route can list all Pi-available providers/models with key status
- Startup check verifies Pi-native skills are installed at `~/.agents/skills/` (start-work-begin, start-work-plan, start-work-run)

---

**⬇️ DA-02 (Dash AI CLI) executes here — see `.planning/DA-02-dash-ai-cli/` ⬇️**

---

## Phase 03 — Frontend Event Streaming *(post-DA-02)*
**Objective:** Update the React UI to consume structured Pi SDK events
**Status:** ✅ Complete
**Outputs:**
- WebSocket events replaced with richer Pi event types (`tool_execution_start/end`, `message_update`, `turn_start/end`)
- Task timeline panel shows real-time agent activity: which tools are running, their output, thinking blocks
- Diff capture remains via `git diff HEAD` after session completion
- Status badges and progress indicators reflect live session state
- Event types shared between CLI `watch` command and frontend timeline
- **⚠️ Deferred from Phase 02:** Update `AuthWarningBanner` to call `GET /api/auth/status` (Pi auth) instead of reading OpenCode credentials

## Phase 04 — Electron Shell *(post-DA-02)*
**Objective:** Package Dash AI as an Electron desktop app wrapping the CLI engine
**Status:** 📋 Deferred until DA-02 complete
**Outputs:**
- Electron main process: spawns Hono server internally, opens BrowserWindow
- `electron-builder` or `electron-forge` config for packaging
- `better-sqlite3` native module rebuilt for Electron
- API token auth simplified (local app) or made optional
- Single binary/installer for at least Linux and macOS
- Reuses embedded server pattern established by CLI's `packages/cli/src/embedded/`

## Phase 05 — IPC & Polish *(post-DA-02)*
**Objective:** Replace WebSocket with Electron IPC, finalize cross-platform support
**Status:** 📋 Deferred until DA-02 complete
**Outputs:**
- WebSocket layer replaced with `ipcMain`/`ipcRenderer` for event streaming
- Server serves only the Electron renderer (no external HTTP needed)
- `xterm.js` or inline panel for agent output (replaces terminal window requirement)
- README updated for Electron installation model
- `AGENTS.md` updated to reflect new architecture
- `pnpm build` clean, zero TS errors

## Notes
- Phase 01-02 are the foundation — both CLI and Electron depend on Pi SDK being integrated
- The CLI (DA-02) establishes the embedded server pattern that Electron later reuses
- Phase 03-05 event streaming benefits from the CLI `watch` command's event rendering work
- Phase 05 is polish and can absorb items from deferred pcw-101 phases (06, 07)
- Plans live in `phases/`
- Use `/skill:start-work-plan` to deepen a phase when needed
- Use `/skill:start-work-run` to execute a plan when ready
