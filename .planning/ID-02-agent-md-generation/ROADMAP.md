# ID-02 — Agent.md Generation — ROADMAP

## Phase 01 — Backend Analysis & Generation Service

**Objective:** Create service to analyze project and generate Agent.md via LLM

**Outputs:**
- [ ] `packages/server/src/services/agentMdService.ts` — analysis + generation logic
- [ ] Project structure analysis (read package.json, tsconfig.json, README, list directories)
- [ ] LLM prompt construction (ask for concise tech stack, conventions, architecture)
- [ ] Use default provider/model from Settings (depends on ID-01)
- [ ] Save generated content to `{project_path}/Agent.md`
- [ ] Error handling for file system issues

## Phase 02 — API Endpoint

**Objective:** Add HTTP endpoint to trigger generation

**Outputs:**
- [ ] `POST /api/projects/:id/generate-agent-md` route
- [ ] Check if Agent.md already exists (for warning)
- [ ] Call agentMdService.generate()
- [ ] Return success or error
- [ ] Wire up in `projects.ts` routes

## Phase 03 — Frontend UI

**Objective:** Add button and markdown viewer to Project page

**Outputs:**
- [ ] Update `ProjectDetailPage.tsx` — add "Generate Agent.md" button
- [ ] Check if Agent.md exists on project load (read filesystem via API)
- [ ] "Re-generate Agent.md" button (warns about overwrite)
- [ ] `AgentMdViewer.tsx` component — scrollable markdown display
- [ ] Show "No Agent.md found" placeholder when missing
- [ ] Loading state during generation

## Phase 04 — CLI Command

**Objective:** Add CLI command for Agent.md generation

**Outputs:**
- [ ] `dash-ai projects generate-agent-md <project-id>` command
- [ ] Use same API endpoint
- [ ] Output success/error messages

## Phase 05 — Testing & Polish

**Objective:** Verify generation quality and UI/UX

**Outputs:**
- [ ] Test on sample projects (Node.js, Python, etc.)
- [ ] Verify Agent.md content is useful and concise
- [ ] Test overwrite warning
- [ ] Test scrollable viewer with long content
- [ ] Error handling: project path doesn't exist, permission denied, etc.

---

## Dependencies

- **ID-01 (App Settings)** — Uses default provider/model
- **Pi SDK** — For LLM generation

## Notes

- Agent.md should be concise (prompt should emphasize this)
- Analysis should be fast (don't read all files, just key ones)
- Consider caching analysis results if re-generating quickly
- Viewer should handle code blocks nicely (syntax highlighting if possible)
