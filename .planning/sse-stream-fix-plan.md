# SSE Stream Fix — Implementation Plan

**File:** `packages/server/src/opencode/planningRunner.ts`
**Problem:** Zero SSE events reach the `streamLoop` after `sending_prompt`, despite the OpenCode server publishing hundreds of events on its internal bus.
**Root cause:** Lazy async generator + fire-and-forget execution pattern = the SSE HTTP connection either never opens, or opens too late and is aborted before events arrive.

---

## Status of Changes

| Change | Status | Lines affected | Description |
|--------|--------|---------------|-------------|
| A | DONE | 4 | Import `createOpencodeClient` |
| B | DONE | 132-140 | Per-session client with `x-opencode-directory` header |
| C | TODO | ~217, ~356-361 | AbortController earlier + concurrent start with proper await |
| D | TODO | ~219-256 | Check-then-sleep in poll loop |
| E | TODO | ~167 | Pass `signal` to SSE subscribe call |

---

## Root Cause Analysis

The SDK's SSE client (`serverSentEvents.gen.js`) uses a **lazy async generator**:

```
createSseClient() {
  const createStream = async function* () {
    // fetch() is HERE — line 20 — only runs on first iteration
    const response = await fetch(url, { ...options, headers, signal })
    // ...read loop, yield parsed events...
  }
  const stream = createStream()   // generator object created, body NOT executed
  return { stream }
}
```

`await client.event.subscribe(...)` resolves immediately with `{ stream: <unstarted generator> }`. The HTTP connection to `/event` does NOT open until the first `for await` iteration inside `streamLoop()`.

The current code:
```typescript
streamLoop()                              // fire-and-forget — NOT awaited
const pollResult = await pollForCompletion()  // awaited — runs for ~5 min
abortController.abort()                   // fires immediately when poll returns
```

Because `streamLoop()` is not awaited, it gets scheduled but may not begin iterating (and thus may not open the HTTP connection) before `pollForCompletion()` consumes the event loop. When poll finally returns after 5+ minutes, `abort()` fires, and the stream — which may have just started or not started at all — is killed with zero events processed.

**Evidence:** `codingRunner.ts` uses the identical SDK call pattern but with a direct `for await` (no fire-and-forget), and it works.

---

## Change C — Concurrent Start with Proper Await + Move AbortController Earlier

This is the primary fix. Two sub-parts:

### C1: Move AbortController creation before `subscribe()` (currently line ~217)

The `AbortController` must exist before `subscribe()` is called so its signal can be passed to the SSE client (see Change E). Move it to just before the subscribe call, around line 160.

**Current location (line 217):**
```typescript
const abortController = new AbortController()
```

**New location (before line 167, just before the subscribe call):**
```typescript
const abortController = new AbortController()

const eventResult = await client.event.subscribe({
  query: { directory: input.repoPath },
  signal: abortController.signal,          // Change E (see below)
})
```

### C2: Replace fire-and-forget with concurrent start + drain

**Current code (lines ~356-361):**
```typescript
// Race: whichever resolves first (poll detecting finish, or stream idle event) wins.
// We do NOT await streamLoop here — it blocks forever on the open SSE connection.
// Instead, poll drives completion; streamLoop runs fire-and-forget for live events.
streamLoop() // fire and forget — events flow to UI but don't block completion
const pollResult = await pollForCompletion()
abortController.abort() // signal stream loop to stop on next iteration
```

**Replace with:**
```typescript
// Start both concurrently so the SSE generator begins iterating immediately.
// Lazy async generators don't open the HTTP connection until the first `for await`,
// so we must ensure streamLoop enters its loop in the same event-loop turn as poll.
// Poll is the primary completion signal; stream provides live UI events.
const pollPromise = pollForCompletion()
const streamPromise = streamLoop()
const pollResult = await pollPromise   // wait for poll to detect finish === "stop"
abortController.abort()                // signal stream + SSE reader to stop
await streamPromise                    // drain any in-flight onEvent calls cleanly
```

**Why this works:** Both promises begin executing in the same microtask. `pollForCompletion()` runs synchronously until its first `await` (the `session.messages` call with Change D, or `setTimeout` without). Then `streamLoop()` runs synchronously until its first `await` — the `for await` entering the generator, which triggers `fetch()` at `serverSentEvents.gen.js:20`. The SSE HTTP connection opens promptly, before the poll's first check returns.

After poll detects `finish === "stop"`, `abort()` fires, the SSE reader is cancelled via the signal (Change E), `streamLoop` exits cleanly, and `await streamPromise` ensures any in-flight `onEvent` DB writes + WebSocket broadcasts complete before proceeding.

---

## Change D — Check-Then-Sleep in Poll Loop

Reorder the poll loop so the first check fires immediately instead of sleeping 5 seconds first.

**Current code (lines ~219-256):**
```typescript
const pollForCompletion = async (): Promise<"completed" | "error" | "timeout"> => {
  while (!abortController.signal.aborted) {
    if (Date.now() > deadline) return "timeout"
    await new Promise((r) => setTimeout(r, 5_000))       // <-- sleep FIRST
    if (abortController.signal.aborted) break
    try {
      const msgsResult = await anyClient.session.messages({
        path: { id: sessionId },
        query: { directory: input.repoPath },
      })
      // ... check finish, auto-answer questions ...
    } catch {
      // Transient poll error — keep trying
    }
  }
  return "completed"
}
```

**Replace with:**
```typescript
const pollForCompletion = async (): Promise<"completed" | "error" | "timeout"> => {
  while (!abortController.signal.aborted) {
    if (Date.now() > deadline) return "timeout"
    try {
      const msgsResult = await anyClient.session.messages({
        path: { id: sessionId },
        query: { directory: input.repoPath },
      })
      // ... check finish, auto-answer questions (UNCHANGED) ...
    } catch {
      // Transient poll error — keep trying
    }
    await new Promise((r) => setTimeout(r, 5_000))       // <-- sleep AFTER check
    if (abortController.signal.aborted) break
  }
  return "completed"
}
```

**Why:** Eliminates the 5-second blind window at startup. If the session errors out immediately, poll detects it on the first iteration rather than waiting 5 seconds. The check-then-sleep pattern also means the `streamLoop` gets a full 5 seconds of uncontested event-loop time on its first iteration, which is plenty for the SSE connection to open and start yielding.

---

## Change E — Pass AbortSignal to SSE Subscribe

The SSE client at `serverSentEvents.gen.js:8` captures a signal at generator creation time:

```javascript
const signal = options.signal ?? new AbortController().signal;
// ...
signal.addEventListener("abort", abortHandler)  // line 35
// abortHandler calls reader.cancel()           // line 29
```

If we pass our `abortController.signal` to `subscribe()`, then when `abort()` fires after poll completes, the SSE `reader` is cancelled immediately at the HTTP level. Without this, `streamLoop`'s `for await` blocks on `reader.read()` until the next SSE event (e.g., a heartbeat) arrives, and only THEN checks `abortController.signal.aborted`.

**Current code (line ~167):**
```typescript
const eventResult = await client.event.subscribe({
  query: { directory: input.repoPath },
})
```

**Replace with:**
```typescript
const eventResult = await client.event.subscribe({
  query: { directory: input.repoPath },
  signal: abortController.signal,
})
```

**Prerequisite:** Change C1 must be applied first (AbortController created before this line).

**Note on streamLoop error handling:** The existing catch block at lines 349-353 already handles abort errors:
```typescript
} catch (streamError) {
  if (abortController.signal.aborted) return // expected — poll won the race
  const msg = streamError instanceof Error ? streamError.message : String(streamError)
  if (!msg.includes("aborted")) throw streamError
}
```

When the signal cancels the reader, the generator may throw an abort error from `reader.read()`. This catch block handles it correctly — no changes needed.

---

## Changes Already Applied (for reference)

### Change A — Import (DONE)

```typescript
// Before:
import { createOpencode } from "@opencode-ai/sdk"

// After:
import { createOpencode, createOpencodeClient } from "@opencode-ai/sdk"
```

### Change B — Per-Session Client with Directory Header (DONE)

```typescript
// Before:
const opencodeInstance = await createOpencode({ config: { provider: providerConfig } })
server = opencodeInstance.server
const client = opencodeInstance.client

// After:
const opencodeInstance = await createOpencode({ config: { provider: providerConfig } })
server = opencodeInstance.server
// Create a per-session client that includes x-opencode-directory on every request.
// Without this, directory is only a query param on subscribe() but not a persistent
// header, which can cause OpenCode to route SSE events to the wrong internal bus.
const client = createOpencodeClient({
  baseUrl: opencodeInstance.server.url,
  directory: input.repoPath,
})
```

**Assessment:** This is a defensive improvement, NOT the root cause fix. `codingRunner.ts` works without it using the same query-param-only pattern. But it's zero-risk and eliminates a whole category of potential routing issues.

---

## Implementation Order

1. **Change C1** — Move `const abortController = new AbortController()` from line ~217 to before the `subscribe()` call (line ~160 area)
2. **Change E** — Add `signal: abortController.signal` to the `subscribe()` call
3. **Change D** — Reorder poll loop to check-then-sleep
4. **Change C2** — Replace fire-and-forget with `pollPromise` / `streamPromise` / `await` pattern

Changes C1 and E are tightly coupled (do together). Changes D and C2 are independent of each other but both depend on C1.

---

## Verification

After all changes, run `pnpm build` to catch TypeScript errors.

Functional verification: trigger a planning task and confirm:
- `PLANNING_EVENT` rows appear in `task_events` with statuses like `agent.text`, `tool.running`, `tool.complete`
- WebSocket clients receive live events during the session (not just after completion)
- Session still completes normally (poll detects `finish === "stop"`)
- No lingering `opencode serve` processes after session ends

---

## Pre-existing Issue (Not In Scope)

The `anyClient.question.list()` and `anyClient.question.reply()` calls use `as any` to access a `question` property that only exists on the v2 SDK client (`OpencodeClient` from `dist/v2/gen/sdk.gen.js`), not the v1 client returned by `createOpencodeClient`. These calls throw at runtime but are silently swallowed by try/catch. Auto-answering questions via poll and stream is broken — but that's a separate issue.
