# DA-IDEA-01 — Dash AI CLI

**Date:** 2026-04-18
**Status:** Idea — under discussion
**Related:** DA-01 (Pi SDK + Electron Migration)

---

## The Core Idea

A `dash-ai` CLI that lets humans and AI agents interact with Dash AI's task pipeline from the terminal, without needing the GUI open. The CLI would talk to the same backend (Hono API or eventually Electron's in-process server).

## Two Audiences, Different Needs

### 1. Human CLI users

```bash
# Project management
dash-ai projects list
dash-ai projects add --name my-app --path ~/projects/my-app

# Task lifecycle
dash-ai tasks create --project my-app --title "Add auth middleware" --planner opus --coder sonnet
dash-ai tasks plan <task-id>                     # trigger planning
dash-ai tasks plan <task-id> --feedback "..."    # iterate with feedback
dash-ai tasks plan-docs <task-id> --file BRIEF   # read plan docs in terminal
dash-ai tasks approve-plan <task-id>             # mark ready to code
dash-ai tasks list --status RUNNING

# Review
dash-ai tasks diff <task-id>                     # show diff
dash-ai tasks approve <task-id>                  # approve changes
dash-ai tasks reject <task-id> --reason "..."

# Monitoring
dash-ai tasks watch <task-id>                    # stream live events (tool calls, text output)
dash-ai tasks logs <task-id>                     # show session log
```

This is pretty straightforward — it's a REST API client with nice formatting. Think `gh` (GitHub CLI) or `railway` CLI.

### 2. AI Agent consumers

This is the more interesting case. An AI agent (running in pi, Claude Code, or any other harness) could delegate structured work to Dash AI:

```bash
# Agent creates a task and waits for the full pipeline
dash-ai run --project my-app --title "Add rate limiting" --wait

# Agent checks status programmatically
dash-ai tasks status <task-id> --json

# Agent consumes plan docs as context
dash-ai tasks plan-docs <task-id> --file ROADMAP --stdout  # pipe to stdout for agent consumption

# Agent delegates and polls
dash-ai tasks create --project my-app --title "Fix auth bug" --auto-plan --json
# returns { "taskId": "abc123", "status": "IN_PLANNING" }
dash-ai tasks wait <task-id> --timeout 600  # block until complete or failed
```

The key difference: `--json` output, `--wait`/`--timeout` flags, machine-parseable formats, exit codes that indicate success/failure.

## Where It Gets Interesting

### The "agent-to-agent" delegation pattern

This is where the real value is. Imagine:

1. **A human is working in pi** on a feature
2. They realize there's a separate bug to fix in another project
3. Instead of context-switching, they tell pi: *"File a dash-ai task for the auth-service repo to fix the token refresh bug"*
4. pi runs `dash-ai tasks create --project auth-service --title "Fix token refresh" ...`
5. The task enters Dash AI's queue, gets planned and coded by its own personas
6. The human reviews it later in the dashboard or via `dash-ai tasks diff`

Or even more powerful:

1. **A pi coding session** is working on a complex feature
2. It hits a cross-cutting concern that touches another repo
3. It shells out to `dash-ai run --project other-repo --title "Update API client types" --wait`
4. Dash AI plans, codes, and returns the result
5. The original pi session continues with the context

This turns Dash AI into an **agent orchestration layer** — not just a kanban board, but a way for agents to delegate to other agents with structured workflows.

### The `dash-ai run` command is the killer feature

```bash
dash-ai run \
  --project my-app \
  --title "Add pagination to user list endpoint" \
  --description "The /api/users endpoint returns all users. Add cursor-based pagination with page size of 50." \
  --planner opus \
  --coder sonnet \
  --wait \
  --json
```

This single command:

1. Creates a task (DRAFT)
2. Starts planning (IN_PLANNING) — runs `start-work-begin` + `start-work-plan`
3. Auto-approves the plan (READY_TO_CODE)
4. Starts coding (RUNNING) — runs `start-work-run`
5. Returns the diff and status

For an AI agent consumer, this is essentially a "sub-agent with structure" — the planning and coding personas handle the work, the calling agent gets back a verified diff.

## Architecture Questions

### 1. Does the CLI talk to the API server, or can it run standalone?

**Option A: API client only** — CLI requires the Dash AI server (or Electron app) to be running. Lighter to build, but requires a running daemon.

**Option B: Embedded mode** — CLI can spin up an in-process server (Hono + SQLite + Pi SDK) and do everything locally. Heavier, but works as a standalone tool. Could be `dash-ai run` (standalone) vs `dash-ai tasks create` (API client mode).

Lean toward **Option A first, Option B later**. The Electron app will be running anyway for GUI users. For agent consumers, the `--wait` flag means they just need the server URL + auth token.

### 2. Auth model

The current Bearer token auth works fine for CLI:

```bash
export DASH_AI_TOKEN=xxx
export DASH_AI_URL=http://localhost:3000  # or the Electron app's internal port
```

For agent-to-agent, the calling agent just needs these env vars. Simple.

### 3. Should the CLI be a separate package or part of the monorepo?

Keep it in the **monorepo** — add `packages/cli/` alongside `packages/server/` and `packages/client/`. It shares the same API types, and can be published as a standalone `npm install -g @dash-ai/cli`.

### 4. Real-time event streaming in the terminal

`dash-ai tasks watch <task-id>` should show live agent activity — tool calls, file edits, text output. This could use:

- The existing WebSocket connection (works with current architecture)
- SSE (simpler for CLI consumers)
- Polling with `--json` (simplest, good enough for agents)

### 5. Relationship to pi's existing CLI

This is worth being explicit about: **`dash-ai` CLI is not a replacement for `pi`**. They're complementary:

- **`pi`** — interactive coding agent, you talk to it directly, it has tools
- **`dash-ai`** — task orchestration layer, you delegate structured work to it, it manages planning + coding personas

A human might use both. An AI agent in pi might call `dash-ai` as a tool (`bash` → `dash-ai run ...`). An agent in Dash AI might call pi sessions internally. They form a stack.

---

## Open Questions (to nail down before PRD)

1. **Standalone vs daemon-dependent?** — Does `dash-ai run` work without any server running, or does it need the Electron app / daemon?
2. **Priority audience?** — Is this primarily for humans who want a terminal workflow, or primarily for agent-to-agent delegation? The design differs.
3. **Scope of first version?** — A minimal V1 could be just task CRUD + status + diff viewing. The `dash-ai run` end-to-end command is the power feature but adds complexity.
4. **How does an agent consume results?** — Just the diff? The full plan docs? A summary? This affects what the CLI returns.
