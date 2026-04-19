# DA-02 Phase 04 Summary — Watch Live Events

**Date**: 2026-04-19

## What Was Done

The `tasks watch <id>` command was implemented in the initial scaffold:

```typescript
tasks.command("watch <id>")
  .option("--follow", "keep watching after task completes")
  .option("--json", "output as NDJSON")
```

### Event Rendering (`renderEvent`)

All event types rendered to terminal:

| Event Type | Output |
|------------|--------|
| `PLANNING_EVENT`, `CODING_EVENT` | `⏳ Starting...` / `✓ Complete` |
| `PLANNING_TEXT`, `CODING_TEXT` | Gray streaming text |
| `TOOL_START` | `  → toolName` + truncated args |
| `TOOL_END` | `  ✓ toolName` or `  ✗ toolName` (red) |
| `TURN_START` | `--- Turn N ---` (bold) |
| `TURN_END` | blank line |
| `ERROR` | ⚠ message (red) |

### Features
- **WebSocket**: connects to `ws://{url}/ws/tasks/{id}/stream` with auth header
- **NDJSON mode**: `--json` emits one JSON event per line
- **SIGINT**: gracefully closes WebSocket, task continues server-side
- **Auto-exit**: exits when task reaches terminal state (unless `--follow`)
- **Both modes**: works with thin client (`DASH_AI_URL`) and embedded server

### Diff Stats
`computeDiffStats()` helper counts files changed, lines added/removed from raw diff output.

## Verification
- `dash-ai tasks watch --help` — shows `--follow` and `--json` flags ✓
- Event rendering handles all 8 event types ✓
- `pnpm build` — passes ✓
