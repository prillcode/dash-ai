# AI Dashboard — Use Cases

This document outlines practical use cases for the AI Dashboard, leveraging the OpenCode SDK to automate coding tasks.

## What is OpenCode?

[OpenCode](https://opencode.ai) is an AI coding agent that can:
- Read and modify files
- Run shell commands
- Execute multi-step coding tasks
- Work in a specified working directory

The AI Dashboard orchestrates OpenCode sessions, manages a queue of tasks, and provides real-time monitoring.

---

## Use Cases

### 1. Automated Code Reviews

**Description**: Queue PRs or branches for AI review. The AI reads changed files and provides feedback.

**Workflow**:
1. User submits a review task with a repo path and target branch/PR
2. OpenCode session clones/fetches the repo
3. AI reviews code, leaves comments or generates a review report
4. Results stored as task output for human review

**OpenCode Usage**: `session.prompt()` with review instructions, `file.status()` to get changed files

---

### 2. Bulk Refactoring

**Description**: Apply consistent refactoring across multiple files or a codebase.

**Examples**:
- Rename functions across a codebase
- Extract repeated code into utilities
- Convert class components to functional components
- Update deprecated API usage

**Workflow**:
1. User creates a task describing the refactoring goal
2. OpenCode iterates through target files
3. Applies changes, writes diffs
4. User reviews and approves/rejects

**OpenCode Usage**: `session.prompt()` with refactoring instructions, iterate with `file.status()`

---

### 3. Test Generation

**Description**: Generate unit tests for functions, modules, or entire files.

**Workflow**:
1. User submits task: "Write tests for `src/utils/auth.ts`"
2. OpenCode reads the target file
3. Analyzes functions and generates test cases
4. Creates/modifies test files

**OpenCode Usage**: `session.prompt()` with test generation instructions, `file.write()` to create test files

---

### 4. Documentation Updates

**Description**: Generate or update README files, API docs, JSDoc comments.

**Workflow**:
1. User submits: "Add JSDoc to all functions in `src/api/`"
2. OpenCode reads files, generates documentation
3. Updates files in place

**OpenCode Usage**: `session.prompt()` with documentation instructions

---

### 5. Bug Fixing from Issue Tracker

**Description**: Automate fixing known bugs by providing issue descriptions.

**Workflow**:
1. User creates task with issue description and repo path
2. OpenCode analyzes codebase to find root cause
3. Proposes and applies fixes
4. Optionally runs tests to verify

**OpenCode Usage**: `session.prompt()` with bug description, `shell.exec()` to run tests

---

### 6. Code Migration

**Description**: Migrate code between languages or frameworks.

**Examples**:
- JavaScript → TypeScript
- Component library X → library Y
- CSS → Tailwind

**Workflow**:
1. User specifies source and target formats
2. OpenCode reads all source files
3. Converts and writes new files
4. User reviews migration

**OpenCode Usage**: `session.prompt()` with migration instructions, `file.read()` + `file.write()`

---

### 7. Dependency Updates

**Description**: Update npm packages, fix breaking changes.

**Workflow**:
1. User submits: "Update to React 19, fix breaking changes"
2. OpenCode updates package.json
3. Runs migrations, fixes import changes
4. Runs tests to verify

**OpenCode Usage**: `shell.exec()` for npm commands, `session.prompt()` for fix instructions

---

### 8. Security Vulnerability Fixes

**Description**: Auto-fix known security issues (OWASP Top 10).

**Workflow**:
1. User submits: "Fix SQL injection vulnerabilities in `src/db/`"
2. OpenCode scans and identifies issues
3. Applies secure patterns
4. Reports what was changed

**OpenCode Usage**: `session.prompt()` with security rules, code analysis

---

### 9. Code Quality Improvements

**Description**: Apply linter rules, improve code style.

**Workflow**:
1. User submits: "Apply ESLint rules and fix violations in `src/`"
2. OpenCode runs linter, applies fixes
3. Reports changes made

**OpenCode Usage**: `shell.exec()` to run linters, `file.write()` for fixes

---

### 10. Boilerplate Generation

**Description**: Generate project scaffolding from templates.

**Workflow**:
1. User submits: "Create a new Next.js API route at `/api/users`"
2. OpenCode creates directory structure, files
3. Adds appropriate code

**OpenCode Usage**: `session.prompt()` with template instructions, `file.write()` for new files

---

## Persona Examples

The power of the Dashboard is defining reusable personas for different task types:

| Persona | System Prompt | Use Case |
|---------|--------------|----------|
| `reviewer` | "You are a code reviewer. Focus on bugs, security, and best practices." | Code reviews |
| `refactorer` | "You are a refactoring expert. Make minimal, safe changes." | Bulk refactoring |
| `test-writer` | "You write comprehensive unit tests using Vitest." | Test generation |
| `migrator` | "You specialize in code migrations. Preserve behavior exactly." | Code migration |
| `security-expert` | "You are a security specialist. Prioritize OWASP guidelines." | Security fixes |

---

## Queue Workflow

All use cases follow the same workflow:

```
PENDING → QUEUED → RUNNING → AWAITING_REVIEW → APPROVED/REJECTED → COMPLETE
```

1. **PENDING**: Task created, waiting in queue
2. **QUEUED**: Worker claimed the task
3. **RUNNING**: OpenCode session active, streaming events
4. **AWAITING_REVIEW**: Session complete, diff ready for review
5. **APPROVED/REJECTED**: Human reviewed the changes
6. **COMPLETE**: Task finished

---

## Real-time Features

- **Live Output**: Watch OpenCode's thought process via WebSocket
- **Event Stream**: See tool calls, file changes, errors as they happen
- **Diff Review**: Side-by-side or unified diff view
- **Cost Tracking** (Phase 2): Monitor token usage and costs per session
