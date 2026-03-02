---
phase: 05b-interactive-prompts
plan: 03
type: execute
---

<objective>
Build the client-side UI: persona settings toggles for autoApproveTools/interactive, and the AgentPromptBanner component that surfaces agent questions and permission requests to the user in real-time on the task detail page.

Purpose: This is the UX payoff — when a session pauses with a question or permission request, the user sees it immediately in Dash AI and can respond without leaving the app. The toggles let users configure each persona's interaction mode.

Output: Updated Persona form with two toggle fields; AgentPromptBanner component wired into TaskDetailPage; useRespond mutation hook; human verify checkpoint.
</objective>

<execution_context>
@~/.agents/skills/create-plans/workflows/execute-phase.md
@~/.agents/skills/create-plans/templates/summary.md
@~/.agents/skills/create-plans/references/checkpoints.md
</execution_context>

<context>
@.planning/pcw-101-ai-dashboard-core-refactor/BRIEF.md
@.planning/pcw-101-ai-dashboard-core-refactor/ROADMAP.md
@.planning/pcw-101-ai-dashboard-core-refactor/phases/05b-interactive-prompts/05b-02-SUMMARY.md
@packages/client/src/types/task.ts
@packages/client/src/api/tasks.ts
@packages/client/src/pages/TaskDetailPage.tsx
@packages/client/src/components/tasks/TaskActionBar.tsx
@packages/client/src/pages/PersonaFormPage.tsx
@packages/client/src/api/personas.ts
@packages/client/src/types/persona.ts
</context>

<tasks>

<task type="auto">
  <name>Task 1: Update Persona types, API hooks, and PersonaFormPage with interaction toggles</name>
  <files>
    packages/client/src/types/persona.ts,
    packages/client/src/api/personas.ts,
    packages/client/src/pages/PersonaFormPage.tsx
  </files>
  <action>
    In `types/persona.ts`:
    - Add `autoApproveTools: boolean` and `interactive: boolean` to the Persona type.

    In `api/personas.ts`:
    - Update the PersonaInput type (or wherever create/update payload is typed) to include both fields as optional booleans.
    - No new hooks needed — existing useCreatePersona/useUpdatePersona hooks pass through the payload.

    In `PersonaFormPage.tsx`:
    - Add two toggle/checkbox fields to the form under a new "Interaction Settings" section, below the existing fields:
      - **Auto-approve tools** (autoApproveTools) — label: "Auto-approve tool calls", description: "When enabled, the AI agent will automatically approve all tool permission requests without pausing." Default: checked (true).
      - **Interactive mode** (interactive) — label: "Interactive mode", description: "When enabled, the agent will pause and surface questions to you in the task view for manual reply. When disabled, the agent is instructed not to ask questions." Default: unchecked (false).
    - Use React Hook Form register() for both fields (type="checkbox"). Map checkbox checked state to boolean before submission.
    - Set default values in useForm: `autoApproveTools: persona?.autoApproveTools ?? true`, `interactive: persona?.interactive ?? false`.
    - Style consistently with existing form fields using Tailwind. A simple flex row with a checkbox and label text + description in muted color is sufficient.
  </action>
  <verify>
    Open PersonaFormPage for an existing persona — both toggles are visible with correct defaults.
    Save a persona with interactive=true — GET /api/personas/:id returns interactive: true.
  </verify>
  <done>Persona type updated, form has both toggles, create/edit round-trips both fields correctly</done>
</task>

<task type="auto">
  <name>Task 2: Build AgentPromptBanner component and useRespond hook</name>
  <files>
    packages/client/src/components/tasks/AgentPromptBanner.tsx,
    packages/client/src/api/tasks.ts,
    packages/client/src/pages/TaskDetailPage.tsx
  </files>
  <action>
    **In `api/tasks.ts`**, add `useRespond` mutation:
    ```ts
    export function useRespond() {
      const queryClient = useQueryClient()
      return useMutation({
        mutationFn: ({ taskId, type, text, permissionId, response }: {
          taskId: string
          type: "permission" | "message"
          text?: string
          permissionId?: string
          response?: "once" | "always" | "reject"
        }) => apiClient(`/api/tasks/${taskId}/respond`, {
          method: "POST",
          body: JSON.stringify({ type, text, permissionId, response }),
        }),
        onSuccess: (_, { taskId }) => {
          queryClient.invalidateQueries({ queryKey: ["task-events", taskId] })
        },
      })
    }
    ```

    **Create `AgentPromptBanner.tsx`**:
    - Props: `{ taskId: string; events: TaskEvent[] }` (TaskEvent is the existing event type from the timeline)
    - Logic: scan `events` for the most recent event with `eventType === "AGENT_QUESTION"` or `eventType === "CODING_EVENT"/"PLANNING_EVENT"` with `payload.status === "permission.requested"`. If found and no subsequent `STATUS_CHANGE` or completion event follows it, the session is paused.
    - When paused with an AGENT_QUESTION: render a yellow/amber banner with the question text (`payload.questionText`), a textarea for the user's reply, and a "Send Reply" button that calls `useRespond` with `type: "message"`.
    - When paused with permission.requested: render an amber banner with the permission title (`payload.title`), and three buttons: "Allow Once" (response: "once"), "Always Allow" (response: "always"), "Reject" (response: "reject") — each calls `useRespond` with `type: "permission"`.
    - When not paused: render nothing (`return null`).
    - Note: since the /respond endpoint is 501 stubbed, show a toast or inline note "Response submitted (feature coming soon)" on 501 response — do NOT show an error to the user.

    **In `TaskDetailPage.tsx`**:
    - Import and render `<AgentPromptBanner taskId={task.id} events={events} />` between the PlanningSection and the EventTimeline, only when `task.status === "IN_PLANNING" || task.status === "RUNNING"`.
    - Pass the events array from the existing useTaskEvents query (or equivalent).
  </action>
  <verify>
    TaskDetailPage renders without errors when status is DRAFT (banner returns null).
    When a mock AGENT_QUESTION event exists in the timeline, the banner appears with question text and reply textarea.
    pnpm build exits 0.
  </verify>
  <done>AgentPromptBanner renders correctly for both question and permission pause states; useRespond hook exists; build clean</done>
</task>

<task type="checkpoint:human-verify" gate="blocking">
  <what-built>
    - Persona form has Auto-approve tools + Interactive mode toggles
    - AgentPromptBanner appears on TaskDetailPage for IN_PLANNING/RUNNING tasks when a pause event is detected
    - useRespond mutation hook wired up (calls /respond endpoint, handles 501 gracefully)
  </what-built>
  <how-to-verify>
    1. Run: `pnpm dev`
    2. Navigate to any persona → Edit → confirm "Interaction Settings" section appears with both toggles
    3. Toggle "Interactive mode" on, save, reload — confirm it persists
    4. Navigate to a task in IN_PLANNING status — confirm no banner appears (no pause events yet)
    5. Run: `pnpm build` — confirm zero TypeScript errors
  </how-to-verify>
  <resume-signal>Type "approved" to continue, or describe any issues</resume-signal>
</task>

</tasks>

<verification>
- [ ] `pnpm build` exits 0
- [ ] Persona form shows both interaction toggles with correct defaults
- [ ] autoApproveTools and interactive persist correctly through create/edit/reload
- [ ] AgentPromptBanner is present in TaskDetailPage (renders null when no pause events)
- [ ] No TypeScript errors
</verification>

<success_criteria>
- Persona type + form + API all handle both flags end-to-end
- AgentPromptBanner component exists and renders correctly
- useRespond mutation handles 501 gracefully (no user-facing error)
- Phase 05B complete — interactive prompt passthrough foundation is in place
- Human verify checkpoint passed
</success_criteria>

<output>
After completion, create `.planning/pcw-101-ai-dashboard-core-refactor/phases/05b-interactive-prompts/05b-03-SUMMARY.md`:

# Phase 05B Plan 03: Client Interaction UI — Summary

**[One-liner: what shipped]**

## Accomplishments
- [outcome 1]
- [outcome 2]

## Files Created/Modified
- `packages/client/src/types/persona.ts` — autoApproveTools, interactive added
- `packages/client/src/api/tasks.ts` — useRespond hook
- `packages/client/src/pages/PersonaFormPage.tsx` — interaction toggles
- `packages/client/src/components/tasks/AgentPromptBanner.tsx` — new component
- `packages/client/src/pages/TaskDetailPage.tsx` — banner wired in

## Decisions Made
[or "None"]

## Issues Encountered
[or "None"]

## Next Step
Phase 05B complete. Return to Phase 05 (Planning UI) testing, then proceed to Phase 06.
</output>
