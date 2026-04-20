# DA-03 Phase 01 — Database & API Plan

## Objective
Create the settings infrastructure: database table for key-value storage and REST API endpoints for reading/writing settings.

## Context
Settings will store user preferences like default LLM provider and model. These are global settings (not per-user) since Dash AI is a single-user application. The settings must be accessible across Web UI, CLI, and Electron interfaces.

## Current State
- Database uses Drizzle ORM with SQLite
- Schema defined in `packages/server/src/db/schema.ts`
- API routes in `packages/server/src/routes/`
- Services in `packages/server/src/services/`
- No settings table or related infrastructure exists

## Tasks

### Task 1: Add settings table to schema
**File:** `packages/server/src/db/schema.ts`

Add a new `settings` table with:
- `id`: text, primary key (use 'default' for single-row approach, or UUID for multi-row)
- `key`: text, not null, unique (e.g., 'defaultProvider', 'defaultModel')
- `value`: text, not null (JSON stringified value)
- `updatedAt`: text, not null (ISO timestamp)

**Verification:** 
- Table schema compiles without errors
- Run `pnpm db:generate` to create migration (per AGENTS.md rules, do NOT run it interactively)

### Task 2: Create settings service
**File:** `packages/server/src/services/settingsService.ts`

Implement CRUD operations:
- `getSetting(key: string): Promise<string | null>` — get value by key
- `setSetting(key: string, value: string): Promise<void>` — upsert key-value
- `getAllSettings(): Promise<Record<string, string>>` — get all as object
- `getDefaultSettings(): DefaultSettings` — return structured defaults object

Type definition for structured settings:
```typescript
interface DefaultSettings {
  defaultProvider?: string
  defaultModel?: string
}
```

**Verification:**
- Service exports all functions
- TypeScript types are correct
- Functions handle missing keys gracefully (return null/undefined)

### Task 3: Create settings API routes
**File:** `packages/server/src/routes/settings.ts`

Create Hono router with:
- `GET /api/settings` — return all settings as JSON object
  - Response: `{ defaultProvider?: string, defaultModel?: string }`
- `PATCH /api/settings` — update settings
  - Body: `{ defaultProvider?: string, defaultModel?: string }`
  - Validation: provider must be from available providers, model must exist for provider
  - Response: updated settings object

Use Zod for request validation on PATCH endpoint.

**Verification:**
- Routes compile without errors
- Proper error handling for invalid input
- Returns 400 for invalid provider/model

### Task 4: Wire up routes in app
**File:** `packages/server/src/app.ts`

Import and mount the settings router:
```typescript
import { settingsRouter } from './routes/settings'
app.route('/api/settings', settingsRouter)
```

**Verification:**
- Server starts without errors
- `GET /api/settings` returns empty object `{}` initially
- `PATCH /api/settings` with valid data persists and returns settings

## Verification Steps

1. **Build passes:**
   ```bash
   cd packages/server && pnpm build
   # No TypeScript errors
   ```

2. **Database migration created:**
   ```bash
   # Check that migration file exists in:
   ls packages/server/src/db/migrations/
   ```

3. **API endpoints work:**
   ```bash
   # Start server
   pnpm --filter server dev
   
   # Test GET
   curl http://localhost:3000/api/settings
   # Expected: {}
   
   # Test PATCH
   curl -X PATCH http://localhost:3000/api/settings \
     -H "Content-Type: application/json" \
     -H "Authorization: Bearer $API_TOKEN" \
     -d '{"defaultProvider":"anthropic","defaultModel":"claude-sonnet-4-5"}'
   # Expected: {"defaultProvider":"anthropic","defaultModel":"claude-sonnet-4-5"}
   
   # Test GET again
   curl http://localhost:3000/api/settings
   # Expected: {"defaultProvider":"anthropic","defaultModel":"claude-sonnet-4-5"}
   ```

4. **Settings persist:**
   - Restart server
   - GET /api/settings should still return saved values

## Done Conditions

- [ ] settings table exists in schema.ts with correct columns
- [ ] Migration file created (manually, per AGENTS.md)
- [ ] settingsService.ts exports all CRUD functions
- [ ] settings.ts router handles GET and PATCH
- [ ] Routes wired up in app.ts
- [ ] Server builds without errors
- [ ] API endpoints tested and working
- [ ] Settings persist across server restarts

## Next Step

After this plan is complete, use `/skill:start-work-run` to execute Phase 02 (Settings UI).
