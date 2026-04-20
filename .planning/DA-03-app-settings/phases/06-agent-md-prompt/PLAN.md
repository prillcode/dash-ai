# DA-03 Phase 06 — Agent.md Prompt Setting Plan

## Objective
Add a new `agent_md_prompt` text field to the settings schema. This field stores user-customizable instructions that guide the LLM when generating Agent.md files for project repositories.

## Context
DA-04 will implement Agent.md generation for projects. The quality of generated Agent.md files depends heavily on the prompt used. By making this prompt configurable, users can:
- Customize the tone and structure
- Emphasize project-specific conventions
- Adjust length constraints
- Add required sections

## Database Change

### Migration
**File:** `packages/server/src/db/migrations/0003_add_agent_md_prompt.sql`

```sql
-- Add agent_md_prompt column to settings table
-- Stored as a single row with key='agent_md_prompt'
-- No schema change needed - uses existing key-value structure
```

**Note:** Since settings is a key-value table, we don't need a schema migration. We'll just use `setSetting('agent_md_prompt', value)`.

### Default Value
Store a default prompt that generates lean, focused Agent.md files:

```markdown
Generate a concise Agent.md file (max 150 lines) for this project.

Include these sections:

## Tech Stack
- Language(s) and version(s)
- Framework(s) and key dependencies
- Database/ORM if applicable

## Key Conventions
- Import patterns (e.g., path aliases)
- Naming conventions
- Critical coding rules specific to this project

## Architecture
- High-level directory structure
- Key directories and their purposes
- Where different types of code live

## Development Workflow
- Build/test commands
- Pre-commit requirements
- Any project-specific scripts

## Gotchas & Pitfalls
- Common mistakes for this codebase
- Non-obvious requirements
- Things that break easily

Rules:
- Use bullet points, not long paragraphs
- Be specific to THIS project (omit generic advice)
- Focus on what an AI coding agent needs to know
- Keep it under 150 lines
- Structure with clear markdown headings
```

## API Changes

### Update Settings Interface
**File:** `packages/server/src/services/settingsService.ts`

Add to `DefaultSettings` interface:
```typescript
export interface DefaultSettings {
  // ... existing fields ...
  agentMdPrompt?: string
}
```

Update `getDefaultSettings()` to include:
```typescript
agentMdPrompt: allSettings.agentMdPrompt ?? DEFAULT_AGENT_MD_PROMPT
```

### Update API Validation
**File:** `packages/server/src/routes/settings.ts`

Add to `updateSettingsSchema`:
```typescript
agentMdPrompt: z.string().max(5000).optional()
```

## UI Changes

### Settings Page
**File:** `packages/client/src/pages/SettingsPage.tsx`

Add new section:

**Section: Agent.md Generation**
- Textarea for `agentMdPrompt`
- Show character count (max 5000)
- "Reset to Default" button
- Preview/help text explaining usage

**Features:**
- Expandable textarea (min 10 rows, can grow)
- Markdown syntax highlighting (optional)
- Placeholder shows default prompt

### Form Behavior
- Load current prompt (or default if empty)
- Track dirty state
- Save to settings on submit
- Reset button restores default

## Default Prompt Constant

**File:** `packages/server/src/services/settingsService.ts`

```typescript
export const DEFAULT_AGENT_MD_PROMPT = `Generate a concise Agent.md file (max 150 lines) for this project.

Include these sections:

## Tech Stack
- Language(s) and version(s)
- Framework(s) and key dependencies
- Database/ORM if applicable

## Key Conventions
- Import patterns (e.g., path aliases)
- Naming conventions
- Critical coding rules specific to this project

## Architecture
- High-level directory structure
- Key directories and their purposes
- Where different types of code live

## Development Workflow
- Build/test commands
- Pre-commit requirements
- Any project-specific scripts

## Gotchas & Pitfalls
- Common mistakes for this codebase
- Non-obvious requirements
- Things that break easily

Rules:
- Use bullet points, not long paragraphs
- Be specific to THIS project (omit generic advice)
- Focus on what an AI coding agent needs to know
- Keep it under 150 lines
- Structure with clear markdown headings`
```

## Verification Steps

1. **Backend:**
   ```bash
   # GET settings should include agentMdPrompt
   curl http://localhost:3000/api/settings
   # Returns: { ..., "agentMdPrompt": "..." }
   ```

2. **Update:**
   ```bash
   # PATCH should accept and persist agentMdPrompt
   curl -X PATCH http://localhost:3000/api/settings \
     -H "Content-Type: application/json" \
     -d '{"agentMdPrompt":"Custom prompt..."}'
   ```

3. **UI:**
   - Navigate to Settings
   - See "Agent.md Generation" section
   - Textarea shows default prompt
   - Edit, save, refresh → changes persist

4. **Default:**
   - Reset to default button works
   - New users see default prompt

## Done Conditions

- [ ] `agentMdPrompt` in `DefaultSettings` interface
- [ ] `getDefaultSettings()` returns prompt (with default fallback)
- [ ] API accepts `agentMdPrompt` in PATCH
- [ ] Settings UI has textarea for prompt
- [ ] Reset to Default button works
- [ ] Character count shown (max 5000)
- [ ] Default prompt is lean and focused (150 line guideline)
- [ ] All builds pass
- [ ] Manual testing complete

## Integration with DA-04

DA-04 will use this prompt when generating Agent.md:

```typescript
const settings = await settingsService.getDefaultSettings()
const prompt = settings.agentMdPrompt || DEFAULT_AGENT_MD_PROMPT

// Use prompt in LLM call for Agent.md generation
```

## Next Step

After this plan is complete, execute it before or alongside DA-04 implementation.
