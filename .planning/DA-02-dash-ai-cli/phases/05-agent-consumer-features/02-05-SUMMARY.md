# DA-02 Phase 05 Summary — Agent Consumer Features

**Date**: 2026-04-19

## What Was Done

### Review Endpoint
- **Server**: `POST /api/tasks/:id/review` — runs static analysis on diff vs plan
- **CLI**: `tasks review <id> [--persona NAME]` — calls endpoint, outputs structured review
- **Event Type**: Added `REVIEW_GENERATED` to `EventType` union

### Agent-Facing Flags (already in scaffold)
- `tasks create --auto-plan` — creates task and triggers planning immediately
- `tasks diff <id> --stdout` — pipes raw diff for `git apply`
- `tasks plan-docs <id> --stdout` — concatenates all plan docs
- `tasks watch <id> --json` — NDJSON event stream

### Consistent JSON Schema
All `--json` outputs follow `{ success: true, data: {...} }` or `{ success: false, error: {...} }`

### Exit Codes
| Code | Meaning |
|------|---------|
| 0 | Success |
| 1 | General error |
| 3 | Not found (404) |
| 4 | Auth failure (401/403) |
| 5 | Server unreachable |
| 6 | Task failed (`wait` command) |

### Documentation
- `packages/cli/AGENT-USAGE.md` — complete reference for agent integrators
- Example workflows: plan→code→review→approve, streaming, polling

## Verification
- `pnpm build` — passes ✓
- `dash-ai tasks review --help` — shows options ✓
- `dash-ai tasks create --auto-plan` — creates and triggers planning ✓

## Notes
- Full Pi SDK reviewer session (with read-only tools comparing diff to plan) deferred to DA-01 Phase 03
- Current review is static analysis: file counts, line stats, simple heuristics (no debug logs, test presence)
