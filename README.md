# AI Dashboard

A self-hosted AI Agent Dashboard for managing AI agent personas, submitting coding tasks to a queue, and monitoring task execution in real time via OpenCode SDK integration.

## Core Concepts

### Personas
Personas define how AI agents behave. Each persona includes:
- **System Prompt**: Instructions that define the agent's role and behavior
- **Model**: Which AI model to use (e.g., claude-sonnet-4-5)
- **Allowed Tools**: Which tools the agent can use (bash, read, write, edit)
- **Context Files**: Files to automatically inject as context for every task

### Task Queue
Tasks are submitted to a queue and processed by background workers. Each task:
- Is assigned to a specific persona
- Has a priority (1-5, 1 being highest)
- Goes through status transitions: PENDING → QUEUED → RUNNING → AWAITING_REVIEW → APPROVED/REJECTED
- Can fail and be retried

### OpenCode Integration
The dashboard uses the OpenCode SDK to execute AI agents. When a task is claimed by the queue worker:
1. An OpenCode session is created with the persona's model
2. The system prompt and context files are injected
3. The task description is sent to the agent
4. Events are streamed in real-time via WebSocket
5. Diffs and logs are saved for review

## Prerequisites

- **Node.js** LTS (v20+)
- **pnpm** (`npm install -g pnpm`)
- **Turso CLI** (for database management)
- **OpenCode** installed globally (for agent execution)

## Quick Start

### 1. Clone and Install

```bash
git clone <repository-url>
cd ai-dashboard
pnpm install
```

### 2. Configure Environment

Copy the example environment file and fill in your credentials:

```bash
cp .env.example .env
```

Edit `.env` with your values:

```bash
# Turso Database
TURSO_DATABASE_URL=libsql://your-db.turso.io
TURSO_AUTH_TOKEN=your-token-here

# Optional: embedded replica for faster local reads
# TURSO_LOCAL_DB_PATH=/home/user/.ai-dashboard/local.db

# OpenCode working directory
OPENCODE_WORKING_DIR=/home/user/agent-workspaces

# Local storage for diffs and session logs
DIFF_STORAGE_DIR=/home/user/.ai-dashboard/diffs
LOG_STORAGE_DIR=/home/user/.ai-dashboard/sessions

# Auth — all API requests require: Authorization: Bearer <API_TOKEN>
API_TOKEN=your-secure-token-here

# Queue worker
MAX_CONCURRENT_SESSIONS=3

# Server
PORT=3000
NODE_ENV=development

# Client (Vite exposes VITE_ prefixed vars to browser)
VITE_API_TOKEN=your-secure-token-here
```

### 3. Run Database Migrations

```bash
pnpm db:generate
pnpm db:migrate
```

### 4. Development Mode

Start both server and client in parallel:

```bash
pnpm dev
```

- Server runs on `http://localhost:3000`
- Client dev server runs on `http://localhost:5173` (proxies API to server)

### 5. Production Build

```bash
pnpm build
```

The server will serve the built React app from `packages/client/dist`.

## Deployment with PM2

### Install PM2

```bash
pnpm add -g pm2
```

### Start the Server

```bash
pm2 start packages/server/dist/index.js --name "ai-dashboard"
pm2 save
pm2 startup  # auto-start on system boot
```

### Update Deployment

```bash
git pull origin main
pnpm install
pnpm build
pm2 restart ai-dashboard
```

## Cloudflare Tunnel Setup

To expose your homelab dashboard securely:

1. Install cloudflared:

```bash
# Download from https://developers.cloudflare.com/cloudflare-one/connections/connect-apps/install-and-setup/installation/
```

2. Create a tunnel:

```bash
cloudflared tunnel create ai-dashboard
```

3. Configure `~/.cloudflared/config.yml`:

```yaml
tunnel: ai-dashboard
credentials-file: /home/user/.cloudflared/<tunnel-id>.json

ingress:
  - hostname: dashboard.yourdomain.com
    service: http://localhost:3000
  - service: http_status:404
```

4. Run the tunnel:

```bash
cloudflared tunnel run ai-dashboard
```

5. Create DNS record:

```bash
cloudflared tunnel route dns ai-dashboard dashboard.yourdomain.com
```

## API Endpoints

### Personas

| Method | Endpoint | Description |
|--------|----------|-------------|
| GET | `/api/personas` | List all personas |
| POST | `/api/personas` | Create persona |
| GET | `/api/personas/:id` | Get single persona |
| PUT | `/api/personas/:id` | Update persona |
| PATCH | `/api/personas/:id/toggle` | Toggle active status |
| DELETE | `/api/personas/:id` | Soft delete persona |

### Tasks

| Method | Endpoint | Description |
|--------|----------|-------------|
| GET | `/api/tasks` | List tasks (supports filters) |
| POST | `/api/tasks` | Create task |
| GET | `/api/tasks/:id` | Get single task |
| PATCH | `/api/tasks/:id/status` | Update task status |
| GET | `/api/tasks/:id/diff` | Get diff file |

### Events

| Method | Endpoint | Description |
|--------|----------|-------------|
| GET | `/api/tasks/:taskId/events` | List task events |

### WebSocket

| Endpoint | Description |
|----------|-------------|
| `/ws/tasks/:taskId/stream` | Real-time task event stream |

All API requests require `Authorization: Bearer <API_TOKEN>` header.

## Tech Stack

| Layer | Technology |
|-------|-----------|
| Runtime | Node.js (LTS) |
| Package manager | pnpm |
| Backend framework | Hono |
| Database | Turso Cloud (libSQL) |
| ORM / migrations | Drizzle |
| Frontend | React 18 + TypeScript + Vite |
| Styling | Tailwind CSS v3 |
| Data fetching | TanStack Query v5 |
| Forms | React Hook Form + Zod |
| Routing | React Router v6 |
| AI agent execution | OpenCode SDK |

## License

MIT
