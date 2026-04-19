# DA-02 Phase 02 Summary — Task CRUD Commands + Confirmation Prompts

**Date**: 2026-04-19

## What Was Done

### Additions to Existing Commands

**projects.ts:**
- `projects add --name <name> --path <path>` — creates project; `~` in path is expanded
- `projects show <id>` — displays full project details
- `projects remove <id>` — soft-deletes project with interactive confirmation (`--yes` to skip)

**tasks.ts:**
- `tasks update <id> --title/--description/--priority` — updates task fields

### Server Additions

**`PATCH /api/tasks/:id`** (routes/tasks.ts):
- Accepts `{ title?, description?, priority? }`
- Returns updated task or 404

**`updateTask()`** (services/taskService.ts):
- Accepts `{ title?, description?, priority? }`
- Sets `updatedAt` automatically

### Key Design Decisions
- `projects remove` uses `readline` for confirmation prompt; `y` or `yes` confirms
- `tasks update` requires at least one field; exits with code 1 if none provided
- `updateTask` only updates fields that are explicitly provided (partial update)

## Verification
- `dash-ai projects add --name test --path ~/test` — creates ✓
- `dash-ai tasks update <id> --title "New title" --priority 2` — updates ✓
- `dash-ai projects remove --help` — shows `--yes` flag ✓
- `pnpm build` — passes ✓
