# OpenCode SSE Stream — Opus Handoff Prompt

You are debugging a Node.js/TypeScript backend that integrates with the OpenCode AI SDK
(`@opencode-ai/sdk` v1.2.15) to run AI agent sessions. The core problem: the SSE event
stream yields zero events after `sending_prompt`, even though the OpenCode server log
confirms `message.part.updated` events are being published on the internal bus.

## Architecture

- Hono backend spawns `opencode serve --port=4096` via `createOpencode()` from the SDK
- `client.event.subscribe({ query: { directory } })` returns `{ stream }` — an async
  generator that yields parsed JSON from the `/event` SSE endpoint
- A `streamLoop()` runs fire-and-forget consuming `eventResult.stream`
- `pollForCompletion()` is awaited — polls `GET /session/{id}/message` every 5s to
  detect `finish === "stop"`

## What we observe

1. Events DO flow up to `sending_prompt` (those are emitted before the stream loop starts)
2. After the prompt is sent, the OpenCode server log shows hundreds of
   `service=bus type=message.part.delta publishing` lines — the model IS running
3. But **zero** subsequent `PLANNING_EVENT` rows appear in the database
4. The session IS completing (`BRIEF.md` and `ROADMAP.md` get written to disk), and the
   poll detects `finish === "stop"` after ~5 minutes
5. No errors thrown — the streamLoop silently processes nothing

## The SDK SSE shape

`client.event.subscribe()` calls `sse.get({ url: "/event", query: { directory } })`
which uses this SSE client (simplified):

```js
const createSseClient = ({ url, ...options }) => {
  const createStream = async function* () {
    // connects, reads SSE chunks, parses JSON from `data:` lines, yields each
    yield data  // data is the parsed JSON object
  }
  const stream = createStream()
  return { stream }
}
```

The type for each yielded item is `Event` from the SDK:

```ts
type Event =
  | { type: "message.part.updated"; properties: { part: Part } }
  | { type: "message.part.delta";   properties: { sessionID: string; messageID: string; partID: string; field: string; delta: string } }
  | { type: "session.idle";         properties: { sessionID: string } }
  | { type: "session.status";       properties: { sessionID: string; status: { type: "idle" | "running" } } }
  | { type: "server.heartbeat";     properties: {} }
  // ... many more
```

## The streamLoop code

```ts
const eventResult = await client.event.subscribe({
  query: { directory: input.repoPath },
})

// ... prompt is sent here ...

const streamLoop = async (): Promise<void> => {
  try {
    for await (const raw of eventResult.stream) {
      if (abortController.signal.aborted) break
      const evt = raw as { type: string; properties?: Record<string, any> }
      const props = evt.properties || {}

      if (props.sessionID && props.sessionID !== sessionId) continue

      if (evt.type === "message.part.updated") {
        const part = props.part as any
        // ... extract text/tool and call onEvent
        continue
      }
      if (evt.type === "message.part.delta") continue

      await onEvent("PLANNING_EVENT", { status: evt.type, ...props })
      // ... handle session.idle, session.error etc
    }
  } catch (streamError) {
    if (abortController.signal.aborted) return
    const msg = streamError instanceof Error ? streamError.message : String(streamError)
    if (!msg.includes("aborted")) throw streamError
  }
}

streamLoop() // fire and forget
const pollResult = await pollForCompletion()
abortController.abort()
```

## The createOpencode call

```ts
// createOpencode() source (from SDK):
export async function createOpencode(options) {
  const server = await createOpencodeServer({ ...options })  // spawns `opencode serve --port=4096`
  const client = createOpencodeClient({ baseUrl: server.url })  // NOTE: no `directory` passed here
  return { client, server }
}

// createOpencodeClient accepts a `directory` option that sets x-opencode-directory header:
export function createOpencodeClient(config) {
  if (config?.directory) {
    config.headers = { ...config.headers, "x-opencode-directory": encodedDirectory }
  }
  // ...
}

// Our usage:
const opencodeInstance = await createOpencode({ config: { provider: providerConfig } })
// `directory` is never passed — so x-opencode-directory header is never set globally
// Instead, directory is passed per-request as a query param: { query: { directory: input.repoPath } }
```

## OpenCode server log excerpt (confirmed working session)

```
INFO  service=bus type=message.part.updated publishing   ← emitted on internal bus
INFO  service=bus type=message.part.delta publishing     ← hundreds of these
INFO  service=bus type=session.idle publishing           ← session completed
```

The server IS publishing events. They are not reaching our `for await` loop.

## Hypotheses to evaluate

1. **`directory` must be set via `x-opencode-directory` header, not query param** —
   `createOpencodeClient({ directory })` sets a persistent header; `subscribe({ query: { directory } })`
   only sets it for that one request. OpenCode may use the header to determine which
   instance's event bus to subscribe to, and silently serve an empty stream if it doesn't match.

2. **The SSE stream connects but the internal bus subscription is per-instance** —
   OpenCode boots a separate in-process "instance" per `directory`. If the `/event`
   endpoint resolves the instance from the `x-opencode-directory` header and the header
   is absent, it may subscribe to a no-op bus and yield only heartbeats.

3. **The stream connects too late or misses the window** — `subscribe()` is called
   before `session.prompt()`, so the HTTP connection should be open before events fire.
   However, the SSE client's `createStream()` is a lazy generator — it doesn't actually
   connect until the first `await` in `for await`. Since `streamLoop()` is fire-and-forget
   (not awaited), the generator may not start iterating until after `pollForCompletion()`
   has already returned and `abortController.abort()` has fired.

4. **`abort()` fires before the stream gets its first chunk** — after poll detects
   completion (5+ minutes), `abortController.abort()` is called. But `streamLoop()` was
   never actually awaited — it may have just started its first `reader.read()` call. The
   abort signal cancels the reader immediately, so `for await` exits with zero iterations.

## What I need

1. Identify which hypothesis (or combination) is the actual root cause
2. Provide a corrected implementation that reliably receives SSE events from the
   OpenCode server during an active session — the goal is live event streaming to the UI,
   not just completion detection
3. Specifically: is `directory` as a query param to `subscribe()` sufficient, or must
   it go through `createOpencodeClient({ directory })` to set the persistent header?
4. Is there a way to make the fire-and-forget `streamLoop()` actually start consuming
   the SSE connection immediately (before poll starts), so events aren't missed?

## Context: what the events are used for

Each event from the stream is saved to a SQLite `task_events` table and broadcast via
WebSocket to the React frontend, so users can see live agent activity (text output, tool
calls) while the session runs. Completion detection is a separate concern handled by the
poll loop — the stream is purely for UX.
