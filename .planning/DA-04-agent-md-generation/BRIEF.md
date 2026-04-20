# DA-04 — Agent.md Generation for Projects

## Objective

Add a "Generate Agent.md" button on the Project page that uses the configured default LLM to analyze the project and create a project-level `Agent.md` file. This file contains AI-specific instructions about the project's tech stack, conventions, and architecture.

The Agent.md is read-only in the UI (scrollable markdown viewer). Re-generation overwrites the existing file with a warning confirmation.

## Background

Projects often have specific conventions (tech stack, coding standards, architecture patterns) that the AI should know. Rather than repeating this in every task description, a project-level Agent.md file acts as a "project persona" that the AI can reference.

Example Agent.md contents:
- Tech stack and versions (from package.json, tsconfig.json, etc.)
- Coding conventions (naming, file organization)
- Testing requirements
- Architecture patterns
- Key directories and their purposes

## Scope

### In Scope (MVP)
- "Generate Agent.md" button on Project page
- Backend analysis of project structure (package.json, tsconfig.json, README, directory structure)
- LLM call using default provider/model from Settings (DA-03)
- Save Agent.md to project root directory (filesystem)
- Scrollable markdown viewer on Project page
- Re-generate button with warning: "Existing Agent.md will be overwritten"
- Display "No Agent.md found" when file doesn't exist

### Out of Scope (Future)
- Manual editing of Agent.md in UI
- Multiple Agent.md versions
- Per-task Agent.md customization
- Auto-regenerate on project structure changes

## Key Behaviors

1. **Manual only** — No auto-generation; user must click button
2. **Filesystem storage** — Always read from/write to `{project_path}/Agent.md`
3. **View-only in UI** — Read-only markdown viewer, no editing
4. **Overwrite warning** — Re-generate warns user: "Existing Agent.md will be overwritten"
5. **Uses Settings defaults** — LLM provider/model from App Settings (DA-03)
6. **Concise output** — Prompt asks LLM to keep it brief and focused

## Relevant Files

- `packages/server/src/routes/projects.ts` — add generate-agent-md endpoint
- `packages/server/src/services/agentMdService.ts` — new service for generation logic
- `packages/client/src/pages/ProjectDetailPage.tsx` — add button and viewer
- `packages/client/src/components/projects/AgentMdViewer.tsx` — markdown viewer component

## Acceptance Criteria

- [ ] "Generate Agent.md" button visible on Project page
- [ ] Clicking button triggers backend analysis + LLM generation
- [ ] Agent.md saved to project root directory
- [ ] Markdown viewer displays file content with scroll
- [ ] "No Agent.md found" shown when file doesn't exist
- [ ] Re-generate button warns about overwrite
- [ ] Uses default provider/model from Settings
- [ ] Works in Web, CLI (command), and Electron

## Dependencies

- **DA-03 (App Settings)** — Uses default provider/model from settings
- Pi SDK skills available for LLM calls
