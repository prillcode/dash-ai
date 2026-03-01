# OpenCode SDK Integration

**Package:** `@opencode-ai/sdk` (installed in `packages/server/node_modules/@opencode-ai/sdk`)
**SDK version:** see `packages/server/package.json`
**Last reviewed:** 2026-03-01

This document describes how Dash AI integrates with the OpenCode SDK — which files call it, which SDK methods are used, what the expected inputs/outputs are, and known behaviours and gotchas. It is intended as a living reference for both agents and developers.

---

## Overview

The OpenCode SDK is used to launch and interact with AI coding/planning sessions on behalf of tasks in the queue. It exposes a local HTTP server process that the app communicates with via a generated REST client.

The integration lives entirely in:

```
packages/server/src/opencode/
├── planningRunner.ts   — runs planning sessions (DRAFT → IN_PLANNING → PLANNED)
├── codingRunner.ts     — runs coding sessions (READY_TO_CODE → RUNNING → AWAITING_REVIEW)
└── sessionRunner.ts    — thin adapter; delegates coding tasks to codingRunner
```

The queue worker (`packages/server/src/services/queueWorker.ts`) orchestrates when each runner is called based on task status.

---

## SDK Entry Point

### `createOpencode(options?)`

**Imported from:** `@opencode-ai/sdk`  
**Used in:** `planningRunner.ts`, `codingRunner.ts`  
**Import pattern:** Static top-level import (SDK is a regular `dependencies` entry in `package.json` and is always present after `pnpm install`):

```typescript
import { createOpencode } from "@opencode-ai/sdk"
const { client } = await createOpencode({ config: {} })
```

**What it does:** Spawns a local OpenCode server process and returns a `client` (and a `server` handle). The `client` is an instance of `OpencodeClient` with namespaced method groups.

**Important:** Do NOT destructure or call `server.close()` during normal operation. Closing the server terminates the OpenCode process, which breaks any concurrent sessions. The server is intentionally left running for the lifetime of the Node process.

**Return shape:**
```typescript
{
  client: OpencodeClient,
  server: { url: string; close(): void }
}
```

---

## Client Method Groups Used

The `OpencodeClient` instance exposes namespaced groups. Dash AI currently uses:

| Group | Methods used | File |
|---|---|---|
| `client.session` | `create`, `prompt`, `diff` | `planningRunner.ts`, `codingRunner.ts` |
| `client.event` | `subscribe` | `planningRunner.ts`, `codingRunner.ts` |

All client methods return `Promise<{ data, error, request, response }>` (not the raw value directly). Always check `result.error` before using `result.data`.

---

## `client.session.create()`

**Used in:** `planningRunner.ts:75`, `codingRunner.ts:103`

Creates a new session scoped to a repository directory.

```typescript
const createResult = await client.session.create({
  query: { directory: "/absolute/path/to/repo" },
  body: { title: "Plan: My Task" },
})

if (createResult.error || !createResult.data?.id) {
  throw new Error("Failed to create session")
}
const sessionId = createResult.data.id
```

**Input:**
- `query.directory` — absolute path to the project repo (no `~`)
- `body.title` — human-readable label for the session (optional)

**Output:** `createResult.data` is a `Session` object:
```typescript
type Session = {
  id: string
  projectID: string
  directory: string
  title: string
  version: string
  time: { created: number; updated: number }
  // ...
}
```

**Note (planning):** In `planningRunner.ts` the result is not yet unwrapped via `.data` — it accesses `session.id` directly. This is a known inconsistency to fix if the SDK starts enforcing the wrapper on `create`.

---

## `client.session.prompt()`

**Used in:** `planningRunner.ts:91`, `codingRunner.ts:122`

Sends a prompt (user message) to an existing session to trigger AI execution.

```typescript
const promptResult = await client.session.prompt({
  path: { id: sessionId },
  query: { directory: input.repoPath },
  body: {
    model: { providerID: "anthropic", modelID: "claude-sonnet-4-6" },
    agent: "plan",           // "plan" for planning, "build" for coding
    system: "...",           // persona system prompt
    tools: { bash: true },   // map of tool name → enabled boolean
    parts: [
      { type: "text", text: "Task description..." }
    ],
  },
})

if (promptResult.error) {
  throw new Error(`Prompt failed: ${JSON.stringify(promptResult.error)}`)
}
```

**Model format — critical:** The `model` field must be an **object**, not a string:
```typescript
// CORRECT
model: { providerID: "anthropic", modelID: "claude-sonnet-4-6" }

// WRONG — will be ignored or cause an error
model: "anthropic/claude-sonnet-4-6"
```

Use `normalizeModel()` from `planningRunner.ts` to convert the stored string format:
```typescript
import { normalizeModel } from "./planningRunner"
const model = normalizeModel(persona.model, persona.provider)
// e.g. normalizeModel("deepseek-reasoner", "deepseek")
//   → { providerID: "deepseek", modelID: "deepseek-reasoner" }
// e.g. normalizeModel("anthropic/claude-sonnet-4-6")
//   → { providerID: "anthropic", modelID: "claude-sonnet-4-6" }
```

**Agent values:**
- `"plan"` — invokes the planning agent (for `planningRunner.ts`)
- `"build"` — invokes the coding/build agent (for `codingRunner.ts`)

**Output:** `{ data: { info: AssistantMessage, parts: Part[] }, error }`

---

## `client.session.diff()`

**Used in:** `codingRunner.ts:216`

Retrieves the file diffs produced by a completed session.

```typescript
const diffResult = await client.session.diff({
  path: { id: sessionId },
  query: { directory: input.repoPath },
})

const fileDiffs: Array<FileDiff> = diffResult.data || []
```

**Output:** `diffResult.data` is `Array<FileDiff>` directly (not a nested object):
```typescript
type FileDiff = {
  file: string        // relative file path
  before: string      // original content
  after: string       // modified content
  additions: number
  deletions: number
}
```

**Fallback:** If `diffResult.data` is empty or undefined, `codingRunner.ts` falls back to `git diff HEAD` via `execAsync`.

---

## `client.event.subscribe()`

**Used in:** `planningRunner.ts:123`, `codingRunner.ts:157`

Subscribes to the **global** Server-Sent Events (SSE) stream. This is the only supported way to detect session completion — there is no per-session event endpoint.

```typescript
// subscribe() returns { stream: AsyncGenerator } — iterate .stream, not the result itself
const eventResult = await client.event.subscribe({
  query: { directory: input.repoPath },
})

for await (const raw of eventResult.stream) {
  const evt = raw as { type: string; properties?: Record<string, any> }
  const props = evt.properties || {}

  // Filter to the specific session
  if (props.sessionID && props.sessionID !== sessionId) continue

  // Handle events...
}
```

**Important:** The stream is global — events from all sessions are mixed in. Always filter by `props.sessionID === sessionId`.

### Completion Detection

A session is complete when either of these events arrives for the session:

| Event type | Condition | Meaning |
|---|---|---|
| `session.idle` | `props.sessionID === sessionId` | Session finished normally |
| `session.status` | `props.sessionID === sessionId && props.status?.type === "idle"` | Status transitioned to idle |

```typescript
if (evt.type === "session.idle") { completed = true; break }
if (evt.type === "session.status" && props.status?.type === "idle") { completed = true; break }
```

**Do NOT use** `"session_completed"`, `"session_stopped"`, or `"completed"` — these are not real event types from the SDK.

### Error Detection

```typescript
if (evt.type === "session.error") {
  const err = props.error  // ProviderAuthError | UnknownError | ApiError | ...
  const message = err?.data?.message || err?.name || JSON.stringify(err)
}
```

Error types from `props.error`:
- `ProviderAuthError` — bad or missing API key; `err.data.providerID` names the provider
- `UnknownError` — unexpected failure
- `ApiError` — HTTP-level failure from the AI provider

Auth errors are detected with `detectAuthError()` in `codingRunner.ts` which checks for patterns including `ProviderAuthError`, `401`, `403`, `ANTHROPIC_API_KEY`, etc.

### Full Event Type Union

The SDK exports the following event types on the global stream (from `types.gen.d.ts`):

```
session.created, session.updated, session.deleted
session.status, session.idle, session.compacted
session.diff, session.error
file.edited, file.watcher.updated
message.updated, message.removed, message.part.updated, message.part.removed
permission.updated, permission.replied
todo.updated
command.executed
vcs.branch.updated
lsp.client.diagnostics, lsp.updated
installation.updated, installation.update.available
server.instance.disposed, server.connected
pty.created, pty.updated, pty.exited, pty.deleted
tui.prompt.append, tui.command.execute, tui.toast.show
```

---

## Helper: `normalizeModel()`

**Defined in:** `planningRunner.ts:13`  
**Used in:** `planningRunner.ts:87`, `codingRunner.ts:117`

Converts the string model format stored in the DB to the `{ providerID, modelID }` object required by `client.session.prompt()`.

```typescript
export function normalizeModel(
  model: string,
  provider?: string
): { providerID: string; modelID: string }
```

| Input | Output |
|---|---|
| `"anthropic/claude-sonnet-4-6"` | `{ providerID: "anthropic", modelID: "claude-sonnet-4-6" }` |
| `"deepseek-reasoner"`, `"deepseek"` | `{ providerID: "deepseek", modelID: "deepseek-reasoner" }` |
| `"claude-opus-4"` (no provider arg) | `{ providerID: "anthropic", modelID: "claude-opus-4" }` |

---

## Helper: `checkSkillsInstalled()`

**Defined in:** `planningRunner.ts:5`  
**Called in:** `packages/server/src/index.ts:71` at startup

Checks that the required agent skills exist at `~/.agents/skills/`:

```typescript
const result = checkSkillsInstalled()
// { ok: boolean, missing: string[] }
// Required: ["start-work", "create-plans"]
```

If skills are missing, a warning is logged at startup. Planning tasks will fail at runtime until skills are installed.

---

## Event Flow: Planning Session

```
queueWorker.claimNextPlanningTask()
  └─ runPlanningTaskSession()                        [queueWorker.ts]
       └─ runPlanningSession(input, onEvent)          [planningRunner.ts]
            ├─ createOpencode()                        SDK: spawn server
            ├─ client.session.create()                 SDK: create session
            ├─ client.session.prompt()                 SDK: send task description
            └─ client.event.subscribe()                SDK: wait for session.idle
                 └─ onEvent("PLANNING_EVENT", ...)     → eventService.appendEvent() → DB + WS
       └─ taskService.updateTaskStatus(PLANNED)        on success
       └─ taskService.markTaskFailed()                 on error
```

**Task status transitions:**
`IN_PLANNING → PLANNED` (success) or `IN_PLANNING → FAILED` (error)

**Plan docs location:** Written by the OpenCode agent to `{repoPath}/.planning/{planPath}/` — the SDK agent handles file creation; Dash AI only records the path.

---

## Event Flow: Coding Session

```
queueWorker.claimNextReadyTask()
  └─ runTaskSession()                                [queueWorker.ts]
       └─ runSession(task, persona)                   [sessionRunner.ts]
            └─ runCodingSession(input, onEvent)        [codingRunner.ts]
                 ├─ createOpencode()                   SDK: spawn server
                 ├─ client.session.create()            SDK: create session
                 ├─ client.session.prompt()            SDK: send task + plan ref
                 ├─ client.event.subscribe()           SDK: wait for session.idle
                 └─ client.session.diff()              SDK: capture file diffs
                      └─ fallback: git diff HEAD       if SDK diff empty
            └─ onEvent("CODING_EVENT", ...)           → eventService.appendEvent() → DB + WS
       └─ taskService.updateTaskStatus(AWAITING_REVIEW)  on success
       └─ taskService.markTaskFailed()                    on error
```

**Task status transitions:**
`RUNNING → AWAITING_REVIEW` (success) or `RUNNING → FAILED` (error)

**Output files written to disk:**
- Session log: `~/.dash-ai/sessions/{taskId}/session.log`
- Diff: `~/.dash-ai/diffs/{taskId}/changes.diff`

---

## Auth / Provider Configuration

The OpenCode SDK reads provider credentials from its own config, NOT from the Dash AI `.env`. Credentials are stored by OpenCode at:

```
~/.local/share/opencode/auth.json
```

To add or update credentials, run the OpenCode TUI (`opencode`) and use `/connect`. Alternatively, set environment variables that OpenCode reads:
- `ANTHROPIC_API_KEY`
- `DEEPSEEK_API_KEY`
- `OPENAI_API_KEY`

Auth errors surface as `session.error` events with `err.name === "ProviderAuthError"` and are caught by `detectAuthError()` in `codingRunner.ts`.

---

## Known Gaps / Open Questions

| Item | Status | Notes |
|---|---|---|
| `agent: "plan"` validity | Unverified | Is `"plan"` a real OpenCode agent name? May need to be `"coder"` or another value |
| `agent: "build"` validity | Unverified | Same as above for coding sessions |
| `client.session.create()` result shape | Inconsistency | `planningRunner.ts` accesses `session.id` directly; `codingRunner.ts` uses `createResult.data.id` — needs to be unified once confirmed |
| `client.event.subscribe()` iteration | Resolved | Returns `{ stream: AsyncGenerator }` — iterate `eventResult.stream`, not `eventResult` directly |
| `server.close()` lifecycle | Deferred | Each task call to `createOpencode()` spawns a new server process. Whether this is safe for concurrent tasks or whether a single shared server instance is needed is untested |
| `tools` field in planning prompt | Removed | Planning runner does not pass `tools` — coding runner passes them as `{ [toolName]: true }`. Verify the agent respects this |

---

## File Reference

| File | Role |
|---|---|
| `packages/server/src/opencode/planningRunner.ts` | Planning session orchestration, `normalizeModel`, `checkSkillsInstalled` |
| `packages/server/src/opencode/codingRunner.ts` | Coding session orchestration, diff capture, auth error detection |
| `packages/server/src/opencode/sessionRunner.ts` | Thin adapter: `SessionRunner` class + `runSession()` function calling `codingRunner` |
| `packages/server/src/services/queueWorker.ts` | Polls DB for tasks, calls planning/coding runners |
| `packages/server/src/index.ts` | Calls `checkSkillsInstalled()` at startup, logs warning if skills missing |
| `packages/server/node_modules/@opencode-ai/sdk/dist/gen/types.gen.d.ts` | Full SDK type definitions — authoritative source of truth for all method shapes |
| `packages/server/node_modules/@opencode-ai/sdk/dist/gen/sdk.gen.d.ts` | `OpencodeClient` class definition with all method groups |
