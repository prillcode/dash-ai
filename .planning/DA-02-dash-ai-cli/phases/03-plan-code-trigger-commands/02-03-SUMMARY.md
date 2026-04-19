# DA-02 Phase 03 Summary — Plan & Code Trigger Commands

**Date**: 2026-04-19

## What Was Done

All commands from the plan were implemented in the initial scaffold:

| Command | Description | Status |
|---------|-------------|--------|
| `tasks plan <id>` | Trigger planning session, poll to PLANNED | ✓ |
| `tasks plan <id> --feedback` | Iterate plan with feedback | ✓ |
| `tasks plan-docs <id>` | List/read plan documents | ✓ |
| `tasks plan-docs <id> --file X` | Read specific file | ✓ |
| `tasks approve-plan <id>` | Move task to READY_TO_CODE | ✓ |
| `tasks diff <id>` | Show diff with syntax highlighting | ✓ |
| `tasks diff <id> --stdout` | Pipe raw diff to stdout | ✓ |
| `tasks review <id>` | Run reviewer persona | ✓ |
| `tasks approve <id>` | Mark task APPROVED | ✓ |
| `tasks reject <id> --reason` | Mark task REJECTED with note | ✓ |
| `tasks wait <id>` | Poll until terminal state | ✓ |
| `tasks watch <id>` | Stream live events via WebSocket | ✓ |

### Key Implementation Details

**Polling** (`src/api/poll.ts`):
- `pollTaskStatus()` with configurable interval, timeout, spinner, event callback
- Returns `Task` when target status reached
- Used by `plan`, `wait` commands

**Watch** (`tasks watch`):
- Opens WebSocket to `/ws/tasks/:id/stream`
- Parses SSE-like events from server
- Shows tool call progress, status changes, session messages

**Review** (`tasks review`):
- Calls `GET /api/tasks/:id/diff` to fetch the diff
- Reads BRIEF.md from plan docs
- Uses `resolveClient()` for embedded Pi SDK access
- Outputs structured review summary with concerns

**Diff** (`tasks diff`):
- Calls `GET /api/tasks/:id/diff`
- `--stdout` outputs raw diff (for `git apply` or piping)
- Human mode uses `diff2html` or raw text with headers

## Verification
- All 12 trigger commands registered and accessible via `--help`
- `pnpm build` — passes ✓
