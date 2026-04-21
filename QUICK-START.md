# Dash AI Quick Start

This is the fastest way to get Dash AI running after cloning the repo.

## 1. Install dependencies

```bash
pnpm install
```

## 2. Create your local env file

```bash
cp .env.example .env
```

Edit `.env` and set at least:

```env
API_TOKEN=your-secret-token-here
VITE_API_TOKEN=your-secret-token-here
PORT=3210
MAX_CONCURRENT_SESSIONS=3
```

Notes:
- `VITE_API_TOKEN` must match `API_TOKEN`
- The server loads env from the **repo-root** `.env`
- `3210` is a good default to avoid common port conflicts

## 3. Make sure Pi auth/skills are set up

Dash AI expects your Pi auth at:

```bash
~/.pi/agent/auth.json
```

And the required skills at:

```bash
~/.pi/agent/skills/start-work-begin
~/.pi/agent/skills/start-work-plan
~/.pi/agent/skills/start-work-run
```

If Pi auth is not set up yet, log in on the Linux machine:

```bash
pi login
```

## 4. Apply database migrations

```bash
pnpm db:migrate
```

This creates/updates the SQLite DB used by Dash AI.

## 5. Start the web app

```bash
pnpm start:web
```

If startup succeeds, you should see output like:

```text
Dash AI server running on http://localhost:3210
```

## 6. Open the app

### If you are on the same machine
Open:

```text
http://localhost:3210
```

### If the app is running on a remote Linux machine
Create an SSH tunnel from your local machine:

```bash
ssh -L 43210:localhost:3210 <your-ssh-host>
```

Example:

```bash
ssh -L 43210:localhost:3210 awslinuxacp
```

Then open locally:

```text
http://localhost:43210
```

---

# Keep Dash AI running with PM2

If you want Dash AI to stay running after logout/reboot:

## Start under PM2

```bash
pm2 start pnpm --name dash-ai -- start:web
pm2 save
pm2 startup
```

Run the `sudo ...` command that `pm2 startup` prints.

## Useful PM2 commands

```bash
pm2 status
pm2 logs dash-ai
pm2 restart dash-ai
pm2 stop dash-ai
pm2 delete dash-ai
```

## Typical update flow

```bash
git pull
pnpm install # when new libraries were added/removed
pnpm build 
pm2 restart dash-ai
```

---

# Troubleshooting

## App starts but no AI models are available
Make sure Pi auth exists and is valid:

```bash
ls -l ~/.pi/agent/auth.json
pi login
```

## Port 3210 is already in use
Check what is listening:

```bash
ss -ltnp | rg 3210
```

Then stop the conflicting process or choose another `PORT` in `.env`.

## Windows browser cannot reach the remote app
If the app is running on Linux and your browser is on Windows, use an SSH tunnel:

```bash
ssh -N -f -L 43210:localhost:3210 awslinuxacp
```
Flag breakdown:

- `-N` — don't execute a remote command; just forward ports and sit quietly
- `-L` 43210:localhost:3210 — local port 43210 → remote localhost:3210
- `awslinuxacp` — your SSH host alias

Then browse to:

```text
http://localhost:43210
```
