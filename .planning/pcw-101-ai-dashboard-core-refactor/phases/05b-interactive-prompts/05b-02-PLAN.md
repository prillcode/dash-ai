---
phase: 05b-interactive-prompts
plan: 02
type: execute
---

<objective>
Wire the two persona flags into the runner layer: auto-approve tool permissions, detect agent questions, and add a `POST /api/tasks/:id/respond` endpoint to send follow-up replies.

Purpose: This is the server-side integration — when `autoApproveTools` is true the runner silently handles `permission.updated` events; when `interactive` is true the runner parks on agent questions and emits an `AGENT_QUESTION` event for the UI to surface. The respond endpoint lets the UI send a reply back to OpenCode.

Output: Updated planningRunner + codingRunner with permission/question handling; new respond route; `AGENT_QUESTION` event type in eventService.
</objective>

<execution_context>
@~/.agents/skills/create-plans/workflows/execute-phase.md
@~/.agents/skills/create-plans/templates/summary.md
</execution_context>

<context>
@.planning/pcw-101-ai-dashboard-core-refactor/BRIEF.md
@.planning/pcw-101-ai-dashboard-core-refactor/ROADMAP.md
@.planning/pcw-101-ai-dashboard-core-refactor/phases/05b-interactive-prompts/05b-01-SUMMARY.md
@packages/server/src/opencode/planningRunner.ts
@packages/server/src/opencode/codingRunner.ts
@packages/server/src/services/eventService.ts
@packages/server/src/routes/tasks.ts
@packages/server/src/ws/taskStream.ts
</context>

<tasks>

<task type="auto">
  <name>Task 1: Handle permission.updated in both runners (auto-approve or pause)</name>
  <files>
    packages/server/src/opencode/planningRunner.ts,
    packages/server/src/opencode/codingRunner.ts
  </files>
  <action>
    In the event stream loop of both runners, add handling for `permission.updated`:

    The `Permission` object shape (from SDK types):
    ```ts
    { id, type, pattern, sessionID, messageID, callID, title, metadata, time }
    ```
    The reply endpoint: `client.postSessionIdPermissionsPermissionId({ path: { id: sessionId, permissionID: permission.id }, body: { response: "always" | "once" | "reject" } })`

    **When `autoApproveTools` is true (runner input field):**
    - On `permission.updated` event where `props.sessionID === sessionId`:
      - Call `client.postSessionIdPermissionsPermissionId(...)` with `response: "always"`
      - Emit `onEvent("PLANNING_EVENT" | "CODING_EVENT", { status: "permission.auto_approved", permissionId: props.id, title: props.title })`
      - Continue listening (do NOT break)

    **When `autoApproveTools` is false:**
    - On `permission.updated`, emit `onEvent(..., { status: "permission.requested", permissionId: props.id, title: props.title, sessionId })`
    - Break the event loop and pause (the runner will return with a `paused: true` result — see PlanningResult/CodingResult updates below)

    Add `autoApproveTools: boolean` to `PlanningRunnerInput` and `CodingRunnerInput` interfaces.
    Update `PlanningResult` and `CodingResult` to include `paused?: boolean` and `pauseReason?: "permission" | "question"` for the non-auto case.

    For now, `interactive` mode (agent questions) is handled in Task 2. In this task, only implement the permission.updated path.
  </action>
  <verify>
    With autoApproveTools=true in test input: permission.updated events are auto-replied and logged.
    With autoApproveTools=false: runner pauses and emits permission.requested event.
  </verify>
  <done>Both runners handle permission.updated correctly per the flag; PlanningRunnerInput/CodingRunnerInput updated</done>
</task>

<task type="auto">
  <name>Task 2: Detect agent questions and handle interactive mode</name>
  <files>
    packages/server/src/opencode/planningRunner.ts,
    packages/server/src/opencode/codingRunner.ts,
    packages/server/src/services/eventService.ts
  </files>
  <action>
    Agent questions arrive as `message.updated` events where the message role is "assistant" and the session status goes `idle` — there is no special "question" event type.

    Detection heuristic: after receiving `session.idle` (or `session.status → idle`), check if the last assistant message text ends with a question mark or contains common question patterns ("Want me to", "Should I", "Would you like"). If so, and `interactive` is false, treat as completed (current behavior with `noReply: true`). If `interactive` is true:

    **Interactive mode (`interactive: true`):**
    - On `session.idle` for our sessionId, before marking `completed = true`:
      - Fetch the last assistant message text from the most recent `message.updated` event (track it in a variable as events stream in)
      - If it looks like a question:
        - Emit `onEvent("AGENT_QUESTION", { sessionId, questionText: lastAssistantText, sessionID: sessionId })`
        - Set `paused = true`, break — do NOT mark completed
      - If it does not look like a question: mark completed as normal

    **In eventService.ts:**
    - Add `"AGENT_QUESTION"` to the allowed event types (if there's an enum or union type for EventType). This ensures the event is stored in task_events and broadcast over WebSocket.

    Add `interactive: boolean` to `PlanningRunnerInput` and `CodingRunnerInput`.

    **Note:** When `interactive` is false (current default), this detection runs but always falls through to `completed = true` — no behavior change from current code.
  </action>
  <verify>
    With interactive=false: session.idle always completes (existing behavior preserved).
    With interactive=true and a question in last message: AGENT_QUESTION event is emitted and runner pauses.
  </verify>
  <done>Both runners have interactive-mode question detection; eventService accepts AGENT_QUESTION type</done>
</task>

<task type="auto">
  <name>Task 3: Add POST /api/tasks/:id/respond endpoint</name>
  <files>
    packages/server/src/routes/tasks.ts
  </files>
  <action>
    Add a new route that lets the UI reply to a paused session — either responding to a permission request or sending a follow-up prompt.

    ```ts
    // Zod schema
    const respondSchema = z.object({
      type: z.enum(["permission", "message"]),
      // For type="permission":
      permissionId: z.string().optional(),
      response: z.enum(["once", "always", "reject"]).optional(),
      // For type="message":
      text: z.string().optional(),
    })
    ```

    Route: `POST /api/tasks/:id/respond`
    - Fetch task, verify it exists
    - Verify task status is `IN_PLANNING` or `RUNNING` (only paused tasks can be responded to)
    - Parse body with respondSchema
    - For `type="permission"`: this is a fire-and-forget response — the frontend has the permissionId from the AGENT_QUESTION/permission.requested event. Since the OpenCode server is separate, this endpoint needs to proxy the call to OpenCode. Store the OpenCode session URL or use a shared client. **For now, return 501 Not Implemented with message "Permission reply not yet implemented — requires shared OpenCode client reference."** (Full implementation requires lifting the OpenCode client to a shared singleton — that's an architectural change for a later plan.)
    - For `type="message"`: similarly return 501 for now with clear message.
    - Append an event: `eventService.appendEvent(id, "STATUS_CHANGE", { action: "respond_attempted", type: parsed.data.type })`

    The 501 stubs are intentional — they establish the API contract and give the frontend something to call, while deferring the OpenCode client singleton work (which affects how createOpencode() is called across all runners) to a dedicated plan.
  </action>
  <verify>
    POST /api/tasks/:id/respond with valid body returns 501 with clear message (not 404 or 500).
    POST with invalid body returns 400 with Zod validation error.
    pnpm build exits 0.
  </verify>
  <done>Endpoint exists, validates input, returns 501 with clear message; build clean</done>
</task>

</tasks>

<verification>
- [ ] `pnpm build` exits 0, zero TypeScript errors
- [ ] Both runners compile with updated input interfaces
- [ ] permission.updated handling present in both runners
- [ ] AGENT_QUESTION accepted by eventService
- [ ] POST /api/tasks/:id/respond route exists and validates input
</verification>

<success_criteria>
- Runners handle permission.updated per autoApproveTools flag
- Runners detect agent questions in interactive mode
- AGENT_QUESTION event type wired into eventService
- Respond endpoint exists with correct validation (501 stubs are acceptable)
- Zero TypeScript errors
</success_criteria>

<output>
After completion, create `.planning/pcw-101-ai-dashboard-core-refactor/phases/05b-interactive-prompts/05b-02-SUMMARY.md`:

# Phase 05B Plan 02: Runner Permission + Question Handling — Summary

**[One-liner: what shipped]**

## Accomplishments
- [outcome 1]
- [outcome 2]

## Files Created/Modified
- `packages/server/src/opencode/planningRunner.ts` — permission + question handling
- `packages/server/src/opencode/codingRunner.ts` — same
- `packages/server/src/services/eventService.ts` — AGENT_QUESTION event type
- `packages/server/src/routes/tasks.ts` — /respond endpoint

## Decisions Made
[or "None"]

## Issues Encountered
[or "None"]

## Next Step
Ready for 05b-03-PLAN.md
</output>
