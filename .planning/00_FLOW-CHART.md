# AI Dashboard — Task Flow Chart

End-to-end flow of a coding task from creation to completion.

```
┌─────────────────────────────────────────────────────────────────┐
│                        USER (Browser)                           │
└─────────────────────────────────────────────────────────────────┘
         │
         │  1. Select Persona + Fill Task Form
         ▼
┌─────────────────────────────────────────────────────────────────┐
│  TaskCreatePage                                                 │
│  - Choose persona (Code Reviewer, Refactorer, etc.)             │
│  - Set title, description, repo path, target files              │
│  - Set priority                                                 │
└─────────────────────────────────────────────────────────────────┘
         │
         │  POST /api/tasks
         ▼
┌─────────────────────────────────────────────────────────────────┐
│  taskService.createTask()                                       │
│  Status: PENDING                                                │
└─────────────────────────────────────────────────────────────────┘
         │
         │  Queue worker polls every 5s
         ▼
┌─────────────────────────────────────────────────────────────────┐
│  queueWorker.claimNextPendingTask()                             │
│  Status: QUEUED  (atomic update, prevents double-claim)         │
└─────────────────────────────────────────────────────────────────┘
         │
         │  Semaphore check (MAX_CONCURRENT_SESSIONS=3)
         ▼
┌─────────────────────────────────────────────────────────────────┐
│  sessionRunner.run(task, persona)                               │
│  Status: RUNNING                                                │
│                                                                 │
│  1. createOpencode({ model: persona.model })                    │
│  2. session.create({ title: task.title })                       │
│  3. Inject persona.systemPrompt    (noReply)                    │
│  4. Inject skills in order         (noReply) ◄── Phase 3        │
│  5. Inject persona.contextFiles    (noReply)                    │
│  6. session.prompt(task.description)                            │
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
         │  event.subscribe() stream ends
         ▼
┌─────────────────────────────────────────────────────────────────┐
│  Post-session                                                   │
│  - file.status() → collect changed files                        │
│  - Write diff  → DIFF_STORAGE_DIR/<taskId>/changes.diff         │
│  - Write log   → LOG_STORAGE_DIR/<taskId>/session.log           │
│  - Record cost → session_costs table          ◄── Phase 2       │
│  Status: AWAITING_REVIEW                                        │
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
│  - Cost recorded in monitor                   ◄── Phase 2       │
│  - Skills logged for effectiveness            ◄── Phase 3       │
└─────────────────────────────────────────────────────────────────┘
```

## Task Status Pipeline

```
PENDING → QUEUED → RUNNING → AWAITING_REVIEW → APPROVED → COMPLETE
                                             ↘ REJECTED
                   ↘ FAILED (on error)
```

## Error Handling

```
RUNNING ──► (error thrown in sessionRunner)
         │
         ▼
┌─────────────────────────────────────────────────────────────────┐
│  Status: FAILED                                                 │
│  - errorMessage stored on task                                  │
│  - server.close() called in finally block (no leaked processes) │
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
│  - Finds tasks stuck in QUEUED or RUNNING                       │
│  - Resets them back to PENDING                                  │
│  - They re-enter the queue on next poll                         │
└─────────────────────────────────────────────────────────────────┘
```
