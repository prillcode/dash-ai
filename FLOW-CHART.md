# Dash AI — Task Flow Chart

End-to-end flow of a coding task from creation to completion.

## Planning-First Flow

```
┌─────────────────────────────────────────────────────────────────┐
│                        USER (Browser)                           │
└─────────────────────────────────────────────────────────────────┘
         │
         │  1. Select Planning Persona + Coding Persona
         │     Select Project (registered local repo)
         │     Fill title, description, priority
         ▼
┌─────────────────────────────────────────────────────────────────┐
│  TaskCreatePage                                                 │
│  - Planning Persona (optional) — type: planner                  │
│  - Coding Persona (required)   — type: coder                    │
│  - Project dropdown (replaces free-text repo path)              │
│  - Title, description, priority                                 │
└─────────────────────────────────────────────────────────────────┘
         │
         │  POST /api/tasks
         ▼
┌─────────────────────────────────────────────────────────────────┐
│  taskService.createTask()                                       │
│  Status: DRAFT                                                  │
│  repoPath derived from selected Project (resolvedPath)          │
└─────────────────────────────────────────────────────────────────┘
         │
         │  User clicks "Start Planning" on TaskDetailPage
         │  POST /api/tasks/:id/start-planning
         ▼
┌─────────────────────────────────────────────────────────────────┐
│  Status: IN_PLANNING                                            │
│  queueWorker claims task (sessionId IS NULL guard)              │
└─────────────────────────────────────────────────────────────────┘
         │
         │  Semaphore check (MAX_CONCURRENT_SESSIONS)
         ▼
┌─────────────────────────────────────────────────────────────────┐
│  planningRunner.runPlanningSession(task, planningPersona)       │
│                                                                 │
│  1. Resolve repoPath (~ expanded via os.homedir())              │
│  2. Derive planPath slug from task id + title                   │
│  3. Open OpenCode SDK session in repoPath                       │
│  4. Inject planningPersona.systemPrompt                         │
│  5. Prompt: run start-work + create-plans skill stack           │
│     → scaffolds repoPath/.planning/<planPath>/                  │
│     → generates BRIEF.md, ROADMAP.md, PLAN.md files            │
│  6. Stream events → eventService (live in TaskDetailPage)       │
└─────────────────────────────────────────────────────────────────┘
         │                          │
         │                          │  WebSocket broadcast
         │                          ▼
         │              ┌───────────────────────┐
         │              │  TaskDetailPage        │
         │              │  - Live event stream   │
         │              │  - PlanningSection     │
         │              │    "AI is planning..." │
         │              └───────────────────────┘
         │
         │  Planning session ends
         ▼
┌─────────────────────────────────────────────────────────────────┐
│  Status: PLANNED                                                │
│  planPath saved on task                                         │
│                                                                 │
│  PlanningSection now shows:                                     │
│  - BRIEF.md viewer  (GET /api/tasks/:id/plan-doc?file=BRIEF.md) │
│  - ROADMAP.md viewer                                            │
│  - "Mark Ready to Code" button                                  │
│  - "Iterate Plan" button                                        │
└─────────────────────────────────────────────────────────────────┘
         │
         │  ┌─────────────────────────────────────────────────┐
         │  │  User clicks "Iterate Plan"                      │
         │  │  POST /api/tasks/:id/iterate-plan                │
         │  │  { feedback: "add more error handling..." }      │
         │  │  planFeedback saved → Status: IN_PLANNING        │
         │  │  → loops back to planningRunner (with feedback)  │
         │  └─────────────────────────────────────────────────┘
         │
         │  User clicks "Mark Ready to Code"
         │  PATCH /api/tasks/:id/status → READY_TO_CODE
         ▼
┌─────────────────────────────────────────────────────────────────┐
│  Status: READY_TO_CODE                                          │
│  queueWorker.claimNextReadyTask()                               │
│  Status: QUEUED  (atomic update, prevents double-claim)         │
└─────────────────────────────────────────────────────────────────┘
         │
         │  Semaphore check (MAX_CONCURRENT_SESSIONS)
         ▼
┌─────────────────────────────────────────────────────────────────┐
│  codingRunner.runCodingSession(task, codingPersona)             │
│  Status: RUNNING                                                │
│                                                                 │
│  1. Open OpenCode SDK session in repoPath                       │
│  2. Inject codingPersona.systemPrompt                           │
│  3. Prompt: run /run-plan on .planning/<planPath>/              │
│     → executes first unexecuted PLAN.md (no SUMMARY.md yet)    │
│  4. Stream events → eventService                                │
│  5. On completion: git diff HEAD → changes.diff                 │
│  6. Write log → ~/.dash-ai/sessions/<taskId>/session.log   │
└─────────────────────────────────────────────────────────────────┘
         │                          │
         │                          │  WebSocket broadcast
         │                          ▼
         │              ┌───────────────────────┐
         │              │  TaskDetailPage        │
         │              │  - Live event stream   │
         │              │  - Tool calls          │
         │              │  - Agent output        │
         │              └───────────────────────┘
         │
         │  Coding session ends
         ▼
┌─────────────────────────────────────────────────────────────────┐
│  Status: AWAITING_REVIEW                                        │
│  - diff saved to ~/.dash-ai/diffs/<taskId>/changes.diff    │
│  - log saved to ~/.dash-ai/sessions/<taskId>/session.log   │
└─────────────────────────────────────────────────────────────────┘
         │
         │  Human reviews diff in DiffReviewPanel
         ▼
┌─────────────────────────────────────────────────────────────────┐
│  PATCH /api/tasks/:id/status                                    │
│                                                                 │
│  Approve ──────────────────────────► Status: APPROVED           │
│                                              │                  │
│  Reject  ──────────────────────────► Status: REJECTED           │
└─────────────────────────────────────────────────────────────────┘
         │
         │  (on APPROVED)
         ▼
┌─────────────────────────────────────────────────────────────────┐
│  Status: COMPLETE                                               │
└─────────────────────────────────────────────────────────────────┘
```

## Task Status Pipeline

```
DRAFT → IN_PLANNING ⇄ PLANNED → READY_TO_CODE → QUEUED → RUNNING → AWAITING_REVIEW → APPROVED → COMPLETE
              ↑           │                                                           ↘ REJECTED
              └───────────┘
           (Iterate Plan loop)
                                    (on error at any stage) → FAILED
```

## Persona Roles

```
Planning Persona (type: planner)          Coding Persona (type: coder)
─────────────────────────────────         ──────────────────────────────
Model:  claude-opus-4-5 (default)         Model:  claude-sonnet-4-5 (default)
Tools:  NO bash                           Tools:  bash, read, write, edit, ...
Phase:  IN_PLANNING                       Phase:  RUNNING
Output: BRIEF.md + PLAN.md files          Output: code changes + diff
```

## Error Handling

```
RUNNING / IN_PLANNING ──► (error thrown in runner)
         │
         ▼
┌─────────────────────────────────────────────────────────────────┐
│  Status: FAILED                                                 │
│  - errorMessage stored on task                                  │
│  - Auth errors surface a clear message:                         │
│    "Authentication failed — use '/connect' in OpenCode or       │
│     set environment variables (ANTHROPIC_API_KEY, etc.)"        │
│  - Task visible in queue with error details                     │
└─────────────────────────────────────────────────────────────────┘
```

## Crash Recovery

```
Server restart detected
         │
         ▼
┌─────────────────────────────────────────────────────────────────┐
│  queueWorker startup                                            │
│  - Finds tasks stuck in IN_PLANNING, QUEUED, or RUNNING         │
│  - Resets them back to DRAFT                                    │
│  - User can re-trigger planning or coding manually              │
└─────────────────────────────────────────────────────────────────┘
```

## Startup Skill Check

```
Server starts
         │
         ▼
┌─────────────────────────────────────────────────────────────────┐
│  checkSkillsInstalled()                                         │
│  - Checks ~/.agents/skills/start-work/SKILL.md                  │
│  - Checks ~/.agents/skills/create-plans/SKILL.md                │
│                                                                 │
│  Missing? → console.warn with install instructions              │
│             Planning tasks will FAIL until installed            │
│  OK?      → silent, planning ready                              │
└─────────────────────────────────────────────────────────────────┘
```
