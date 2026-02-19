# AI Agent Dashboard — Component Structure (Option B)

**Backend:** Node.js + Hono (Homelab VM)  
**Database:** Turso Cloud (libSQL via Drizzle ORM)  
**Frontend:** React + TypeScript, TanStack Query, Tailwind CSS  
**Access:** Cloudflare Tunnel → Hono server (single origin, no API Gateway)

---

## Architecture Overview

```
Browser
  │
  └── Cloudflare Tunnel
          │
          └── Hono Server (homelab VM :3000)
                ├── /api/*         ← REST API routes
                ├── /              ← Serves React SPA (static build)
                └── /ws            ← WebSocket for live task event streaming
                        │
                        ├── Turso Cloud (libSQL)   ← persistence
                        ├── OpenCode SDK           ← agent execution
                        └── Local filesystem       ← diffs + session logs
```

Hono serves both the API and the React static build from the same process — no need for a separate web server or reverse proxy on the homelab.

---

## Backend Structure (Hono)

### Folder Layout

```
server/
├── index.ts                  ← Hono app entry, mounts routes, starts server
├── db/
│   ├── client.ts             ← Turso libSQL + Drizzle client
│   ├── schema.ts             ← Drizzle table definitions
│   └── migrations/           ← Drizzle-generated migration files
├── routes/
│   ├── personas.ts           ← CRUD routes for personas
│   ├── tasks.ts              ← Task queue routes
│   └── events.ts             ← Task event log routes
├── services/
│   ├── personaService.ts     ← DB queries for personas
│   ├── taskService.ts        ← DB queries + status transitions for tasks
│   ├── eventService.ts       ← Append + query task events
│   └── queueWorker.ts        ← Long-running loop: polls PENDING tasks, runs OpenCode
├── opencode/
│   ├── sessionRunner.ts      ← Wraps OpenCode SDK, emits events to eventService
│   └── diffParser.ts         ← Parses OpenCode output into diff file
├── ws/
│   └── taskStream.ts         ← WebSocket handler for live event push to frontend
├── middleware/
│   ├── auth.ts               ← Static token auth (Bearer token from env)
│   └── logger.ts             ← Request logging
└── utils/
    ├── id.ts                 ← nanoid wrapper
    └── time.ts               ← ISO 8601 timestamp helpers
```

---

### Hono App Entry (`index.ts`)

```ts
import { Hono } from "hono";
import { serveStatic } from "hono/bun";          // or hono/node depending on runtime
import { personasRouter } from "./routes/personas";
import { tasksRouter } from "./routes/tasks";
import { eventsRouter } from "./routes/events";
import { authMiddleware } from "./middleware/auth";
import { startQueueWorker } from "./services/queueWorker";

const app = new Hono();

app.use("/api/*", authMiddleware);

app.route("/api/personas", personasRouter);
app.route("/api/tasks", tasksRouter);
app.route("/api/tasks/:taskId/events", eventsRouter);

// Serve React SPA static build
app.use("/*", serveStatic({ root: "./dist" }));

startQueueWorker();   // kicks off background polling loop

export default app;
```

---

### API Routes

**`routes/personas.ts`**
```
GET    /api/personas              → list all active personas
POST   /api/personas              → create persona
GET    /api/personas/:id          → get single persona
PUT    /api/personas/:id          → update persona
PATCH  /api/personas/:id/toggle   → toggle isActive
DELETE /api/personas/:id          → soft delete (sets isActive = false)
```

**`routes/tasks.ts`**
```
GET    /api/tasks                     → list tasks (query params: status, personaId, priority)
POST   /api/tasks                     → create task
GET    /api/tasks/:id                 → get single task
PATCH  /api/tasks/:id/status          → update status (approve / reject / cancel)
GET    /api/tasks/:id/diff            → stream diff file from local filesystem
```

**`routes/events.ts`**
```
GET    /api/tasks/:taskId/events      → list all events for a task (for timeline)
```

---

### Queue Worker (`services/queueWorker.ts`)

The heart of Option B — a long-running loop on the VM that processes tasks without any Lambda timeout constraints.

```ts
export async function startQueueWorker() {
  console.log("Queue worker started");

  while (true) {
    try {
      const task = await taskService.claimNextPendingTask();   // atomic status update: PENDING → QUEUED

      if (task) {
        // Don't await — run sessions concurrently (up to a configured concurrency limit)
        runTaskSession(task).catch(err => {
          taskService.markFailed(task.id, err.message);
        });
      }
    } catch (err) {
      console.error("Queue worker error:", err);
    }

    await sleep(3000);   // poll every 3 seconds
  }
}

async function runTaskSession(task: Task) {
  await taskService.updateStatus(task.id, "RUNNING");
  await eventService.append(task.id, "STATUS_CHANGE", { from: "QUEUED", to: "RUNNING" });

  const runner = new SessionRunner(task);

  runner.on("agent_output", (text) => {
    eventService.append(task.id, "AGENT_OUTPUT", { text });
  });

  runner.on("tool_call", (data) => {
    eventService.append(task.id, "TOOL_CALL", data);
  });

  const result = await runner.run();

  await taskService.updateStatus(task.id, "AWAITING_REVIEW", {
    diffPath: result.diffPath,
    outputLog: result.logPath,
    sessionId: result.sessionId,
  });
}
```

**Concurrency:** Use a simple semaphore pattern to cap concurrent OpenCode sessions (e.g. max 3 at once) so the VM doesn't get overloaded.

---

### WebSocket Event Stream (`ws/taskStream.ts`)

Hono supports WebSockets natively. The frontend subscribes to a task's live event stream.

```ts
// ws://your-tunnel/ws/tasks/:taskId/stream
app.get("/ws/tasks/:taskId/stream", upgradeWebSocket((c) => {
  const taskId = c.req.param("taskId");

  return {
    onOpen(_, ws) {
      taskStreamRegistry.subscribe(taskId, ws);
    },
    onClose(_, ws) {
      taskStreamRegistry.unsubscribe(taskId, ws);
    },
  };
}));
```

When `eventService.append()` is called, it also pushes the event to all active WebSocket subscribers for that task — so the frontend gets live updates with no polling overhead.

---

## Frontend Structure (React)

The frontend is identical in page/component structure to the DynamoDB version, with two differences: the API client points to the Hono server directly (same origin via Cloudflare Tunnel), and task events use a WebSocket instead of polling.

### Folder Layout

```
client/
├── src/
│   ├── api/
│   │   ├── client.ts             ← Base fetch to /api/* (same-origin, no CORS needed)
│   │   ├── personas.ts           ← TanStack Query hooks
│   │   ├── tasks.ts
│   │   └── events.ts             ← WebSocket hook for live events
│   ├── components/
│   │   ├── ui/                   ← Button, Badge, FormField, Modal, etc.
│   │   ├── personas/             ← PersonaCard, PersonaForm, PersonaSelector
│   │   ├── tasks/                ← TaskCard, TaskForm, TaskStatusBadge, TaskActionBar
│   │   ├── timeline/             ← TaskTimelinePanel, TimelineEvent
│   │   └── diff/                 ← DiffReviewPanel, DiffViewer
│   ├── pages/
│   │   ├── TaskQueuePage.tsx
│   │   ├── TaskDetailPage.tsx
│   │   ├── TaskCreatePage.tsx
│   │   ├── PersonaListPage.tsx
│   │   └── PersonaFormPage.tsx
│   ├── layouts/
│   │   ├── AppLayout.tsx
│   │   └── Sidebar.tsx
│   ├── types/
│   │   ├── persona.ts
│   │   └── task.ts
│   └── utils/
│       ├── formatters.ts
│       └── constants.ts
├── index.html
└── vite.config.ts
```

---

### Key Difference — Live Events via WebSocket

Instead of polling every 3s for task events, the frontend opens a WebSocket connection per active task.

```ts
// api/events.ts
export function useTaskEventStream(taskId: string, isRunning: boolean) {
  const [events, setEvents] = useState<TaskEvent[]>([]);

  // Load existing events on mount via REST
  const { data: initialEvents } = useQuery({
    queryKey: ["task-events", taskId],
    queryFn: () => fetchTaskEvents(taskId),
  });

  // Open WebSocket only while task is running
  useEffect(() => {
    if (!isRunning) return;

    const ws = new WebSocket(`wss://${location.host}/ws/tasks/${taskId}/stream`);

    ws.onmessage = (msg) => {
      const event = JSON.parse(msg.data) as TaskEvent;
      setEvents(prev => [...prev, event]);
    };

    return () => ws.close();
  }, [taskId, isRunning]);

  return [...(initialEvents ?? []), ...events];
}
```

`TaskTimelinePanel` consumes this hook — it shows the full history immediately from the REST fetch, then appends live events as they stream in.

---

## Data Fetching — TanStack Query Config

```ts
// Personas — changes infrequently
useQuery({ queryKey: ["personas"], staleTime: 60_000 })

// Task list — moderate refresh
useQuery({ queryKey: ["tasks", filters], staleTime: 5_000, refetchInterval: 5_000 })

// Single task detail — moderate refresh (status changes)
useQuery({ queryKey: ["task", taskId], staleTime: 3_000, refetchInterval: 3_000 })

// Task events — loaded once, then WebSocket takes over for live tasks
useQuery({ queryKey: ["task-events", taskId], staleTime: Infinity })
```

---

## Deployment on Homelab VM

### Process Management (PM2)

```bash
# Install
pnpm add -g pm2

# Start the Hono server
pm2 start dist/index.js --name "ai-dashboard"
pm2 save
pm2 startup    # auto-start on VM reboot
```

### Build + Deploy Script

```bash
#!/bin/bash
# deploy.sh — run on homelab VM or via SSH from dev machine

cd /home/aaron/ai-dashboard

git pull origin main

# Build frontend
cd client && pnpm run build && cd ..

# Copy built frontend to server dist
cp -r client/dist server/dist

# Build server
pnpm run build

# Restart
pm2 restart ai-dashboard
```

### Cloudflare Tunnel Config

```yaml
# ~/.cloudflared/config.yml
tunnel: ai-dashboard
credentials-file: /home/aaron/.cloudflared/<tunnel-id>.json

ingress:
  - hostname: dashboard.yourdomain.com
    service: http://localhost:3000
  - service: http_status:404
```

This exposes the entire Hono server (API + React SPA + WebSocket) through a single Cloudflare Tunnel endpoint — no need to open any ports on the VM.

---

## Environment Variables

```bash
# .env on homelab VM
TURSO_DATABASE_URL=libsql://your-db.turso.io
TURSO_AUTH_TOKEN=your-token-here

OPENCODE_WORKING_DIR=/home/aaron/agent-workspaces
DIFF_STORAGE_DIR=/home/aaron/.ai-dashboard/diffs
LOG_STORAGE_DIR=/home/aaron/.ai-dashboard/sessions

API_TOKEN=your-static-bearer-token          # frontend includes this in all requests
MAX_CONCURRENT_SESSIONS=3                   # queue worker concurrency cap

PORT=3000
NODE_ENV=production
```

---

## Dependencies

**Server:**
```json
{
  "hono": "^4.0.0",
  "@hono/node-server": "^1.0.0",
  "@libsql/client": "^0.14.0",
  "drizzle-orm": "^0.40.0",
  "nanoid": "^5.0.0",
  "zod": "^3.0.0"
}
```

**Client:**
```json
{
  "react": "^18.0.0",
  "react-router-dom": "^6.0.0",
  "@tanstack/react-query": "^5.0.0",
  "react-hook-form": "^7.0.0",
  "zod": "^3.0.0",
  "react-diff-view": "^3.0.0",
  "tailwindcss": "^3.0.0"
}
```

**Dev:**
```json
{
  "drizzle-kit": "^0.30.0",
  "typescript": "^5.0.0",
  "vite": "^5.0.0"
}
```
