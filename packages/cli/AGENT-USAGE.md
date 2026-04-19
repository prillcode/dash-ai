# Agent Usage Reference — Dash AI CLI

This document is for AI agents and scripts integrating with Dash AI via the CLI. All commands support `--json` for structured consumption.

## JSON Response Envelope

Every `--json` response follows this schema:

```json
// Success
{ "success": true, "data": { ...command-specific payload } }

// Error
{ "success": false, "error": { "message": "...", "code": N } }
```

## Exit Codes

| Code | Meaning |
|------|---------|
| 0 | Success |
| 1 | General error |
| 2 | Bad arguments |
| 3 | Resource not found |
| 4 | Authentication failed |
| 5 | Server unreachable |
| 6 | Task failed |

---

## Task Lifecycle Commands

### `dash-ai tasks list`
List all tasks, optionally filtered.

```bash
dash-ai tasks list --status DRAFT --json
```

```json
{
  "success": true,
  "data": {
    "tasks": [
      {
        "id": "abc-123",
        "title": "Add rate limiting",
        "status": "PLANNED",
        "priority": 3,
        "planPath": ".planning/da-abc/",
        "createdAt": "2026-04-18T10:00:00Z"
      }
    ]
  }
}
```

### `dash-ai tasks create`
Create a task and optionally start planning immediately.

```bash
dash-ai tasks create \
  --project my-app \
  --title "Add rate limiting" \
  --description "Add middleware with 100 req/min per IP" \
  --planner "Planning Expert" \
  --coder "Coding Agent" \
  --auto-plan \
  --json
```

```json
{
  "success": true,
  "data": {
    "taskId": "abc-123",
    "status": "IN_PLANNING"
  }
}
```

### `dash-ai tasks show <id>`
Get full task details.

```bash
dash-ai tasks show abc-123 --json
```

### `dash-ai tasks update <id>`
Update task fields (partial update).

```bash
dash-ai tasks update abc-123 --title "New title" --priority 2 --json
```

---

## Planning Commands

### `dash-ai tasks plan <id>`
Trigger a planning session. Blocks until PLANNED or FAILED.

```bash
dash-ai tasks plan abc-123 --json
```

```json
{
  "success": true,
  "data": {
    "taskId": "abc-123",
    "status": "PLANNED",
    "planPath": ".planning/da-abc/"
  }
}
```

### `dash-ai tasks plan <id> --feedback "..."`
Iterate an existing plan with feedback.

```bash
dash-ai tasks plan abc-123 --feedback "The BRIEF is too broad. Focus only on auth middleware." --json
```

### `dash-ai tasks plan-docs <id> [--file FILE] [--stdout]`
Read plan documents. Without `--file`, lists available documents.

```bash
# List all plan docs
dash-ai tasks plan-docs abc-123 --json

# Read specific file
dash-ai tasks plan-docs abc-123 --file BRIEF --json

# Pipe all docs to another agent
dash-ai tasks plan-docs abc-123 --stdout > /tmp/plan-docs.txt
pi -p "Review this plan"
```

```json
{
  "success": true,
  "data": {
    "taskId": "abc-123",
    "file": "BRIEF.md",
    "content": "# DA-ABC — Rate Limiting\n\n..."
  }
}
```

### `dash-ai tasks approve-plan <id>`
Mark a planned task as ready to code.

```bash
dash-ai tasks approve-plan abc-123 --json
```

---

## Coding Commands

After planning is approved, the queue worker picks up the task and runs the coding session automatically. You can monitor with:

### `dash-ai tasks wait <id>`
Block until task reaches a terminal state.

```bash
dash-ai tasks wait abc-123 --timeout 1800 --json
# Exit code 6 if FAILED, 0 otherwise
```

### `dash-ai tasks watch <id>`
Stream live events in real-time.

```bash
# Human-readable
dash-ai tasks watch abc-123

# NDJSON for agents/scripts
dash-ai tasks watch abc-123 --json > /tmp/events.ndjson
```

NDJSON output format:
```json
{"type":"TOOL_START","payload":{"toolName":"read","args":{"path":"src/api/auth.ts"}}}
{"type":"TOOL_END","payload":{"toolName":"read","isError":false}}
{"type":"PLANNING_TEXT","payload":{"delta":"The task requires..."}}
```

### `dash-ai tasks diff <id> [--stdout]`
Show or pipe the diff.

```bash
# Preview
dash-ai tasks diff abc-123

# Pipe to git apply
dash-ai tasks diff abc-123 --stdout | git apply --stat

# Apply the diff
dash-ai tasks diff abc-123 --stdout | git apply
```

```json
{
  "success": true,
  "data": {
    "taskId": "abc-123",
    "diff": "--- a/src/middleware...\n+++ b/src/middleware...",
    "stats": {
      "filesChanged": 3,
      "linesAdded": 145,
      "linesRemoved": 12
    }
  }
}
```

---

## Review Commands

### `dash-ai tasks review <id> [--persona NAME]`
Run a reviewer persona to analyze the diff against the plan.

```bash
dash-ai tasks review abc-123 --json
```

```json
{
  "success": true,
  "data": {
    "taskId": "abc-123",
    "review": {
      "summary": "3 file(s) changed, +145/-12 lines.",
      "filesChanged": 3,
      "linesAdded": 145,
      "linesRemoved": 12,
      "matchesPlan": true,
      "concerns": []
    }
  }
}
```

### `dash-ai tasks approve <id> [--note TEXT]`
Mark a reviewed task as approved.

```bash
dash-ai tasks approve abc-123 --note "LGTM" --json
```

### `dash-ai tasks reject <id> --reason TEXT`
Mark a reviewed task as rejected.

```bash
dash-ai tasks reject abc-123 --reason "Missing error handling in rateLimit middleware" --json
```

---

## Project & Persona Commands

```bash
# List projects
dash-ai projects list --json

# Create project
dash-ai projects add --name my-app --path ~/projects/my-app --json

# Show project
dash-ai projects show abc-123 --json

# Remove project (soft delete)
dash-ai projects remove abc-123 -y --json

# List personas
dash-ai personas list --json
```

---

## Example Agent Workflows

### Full pipeline: plan → code → review → approve

```bash
# 1. Create task and start planning
TASK=$(dash-ai tasks create --project my-app --title "Add auth" --planner "Planner" --coder "Coder" --auto-plan --json | jq -r '.data.taskId')

# 2. Wait for planning to complete
dash-ai tasks wait $TASK --status PLANNED

# 3. Review plan docs
dash-ai tasks plan-docs $TASK --stdout

# 4. Approve plan and wait for coding
dash-ai tasks approve-plan $TASK --json
dash-ai tasks wait $TASK --status AWAITING_REVIEW

# 5. Review and approve
dash-ai tasks review $TASK --json
dash-ai tasks approve $TASK --json
```

### Streaming events for monitoring

```bash
# Stream events to a log file
dash-ai tasks watch abc-123 --json > /tmp/task-events.ndjson &
WATCH_PID=$!

# ... do other things ...

# Check log
cat /tmp/task-events.ndjson | jq '.payload.toolName' | sort | uniq -c | sort -rn

# Kill watcher if still running
kill $WATCH_PID 2>/dev/null
```

### Extract diff for local review

```bash
# Get diff and apply locally
dash-ai tasks diff abc-123 --stdout > changes.diff
git apply --check changes.diff && git apply changes.diff
```

### Poll-based monitoring (for agents without streaming support)

```bash
STATUS=$(dash-ai tasks show abc-123 --json | jq -r '.data.status')
while [[ "$STATUS" == "IN_PLANNING" || "$STATUS" == "RUNNING" || "$STATUS" == "QUEUED" ]]; do
  sleep 5
  STATUS=$(dash-ai tasks show abc-123 --json | jq -r '.data.status')
done
echo "Task is now: $STATUS"
```

---

## Configuration

```bash
# Thin client mode (remote server)
export DASH_AI_URL=http://localhost:3000
export DASH_AI_TOKEN=your-token

# Or per-command overrides
dash-ai tasks list --url http://localhost:3000 --token your-token

# Embedded mode (no config needed — CLI starts its own server)
dash-ai tasks list
```

---

## Configuration Command

```bash
# Show current resolved configuration
dash-ai config list
```

Shows which mode is active (thin vs embedded) and resolved values for URL and token.
