# 🌶️ Pepper Tasks

[繁體中文](README.md)

A bidirectional task collaboration board between humans and AI Agents — a digital interface for the boss-secretary model.

Solves two core problems:
1. **Task forgetting** — Tasks disappear after an Agent session ends with no persistent record
2. **Reply forgetting** — Agents ask questions awaiting decisions, but messages get buried and humans forget to respond

---

## Quick Start

```bash
git clone <repo-url>
cd agent-task-board
npm install          # Installs all dependencies + builds frontend & backend
npm start            # http://localhost:3847
```

Requires Node.js >= 18. `npm install` handles everything automatically.

---

## Connect MCP (for AI Agents)

**Auto-generate config (recommended):**

```bash
agent-task-board config
```

Copy the output JSON into your MCP configuration:

```json
{
  "mcpServers": {
    "task-board": {
      "command": "/path/to/node",
      "args": ["/path/to/agent-task-board/dist/cli.js", "mcp"]
    }
  }
}
```

Works with Claude Code, OpenClaw, and any MCP-compatible Agent framework.

> The `config` command auto-detects the correct Node.js path to prevent native addon version mismatches (common with nvm). Even if a mismatch occurs, the system auto-rebuilds at startup.

**Manual config (single Node version):**

```json
{
  "mcpServers": {
    "task-board": {
      "command": "agent-task-board",
      "args": ["mcp"]
    }
  }
}
```

---

## Register as System Service

Auto-start Agent Task Board on boot:

```bash
agent-task-board service install     # Register and start
agent-task-board service status      # Check status
agent-task-board service uninstall   # Remove service
```

| Platform | Mechanism | Config Location |
|----------|-----------|-----------------|
| macOS | LaunchAgent | `~/Library/LaunchAgents/com.agent-task-board.plist` |
| Linux | systemd user service | `~/.config/systemd/user/agent-task-board.service` |

No sudo required. Runs as user-level service with auto-restart on crash.

---

## Architecture

```
┌──────────────────────────────────────┐
│       Single Node.js Process          │
│                                      │
│  ┌──────────┐  ┌──────────────────┐  │
│  │ MCP Server│  │ HTTP Server      │  │
│  │ (stdio)  │  │ (REST API + SPA) │  │
│  └────┬─────┘  └────────┬─────────┘  │
│       │                 │            │
│       └────────┬────────┘            │
│                │                     │
│         ┌──────┴──────┐              │
│         │   SQLite    │              │
│         │ (single file)│              │
│         └─────────────┘              │
└──────────────────────────────────────┘
     ↑ stdio           ↑ HTTP
     │                  │
  Agent              Browser
(OpenClaw/Claude)    (Web UI)
```

Web UI and MCP run as separate processes, safely sharing the same database via SQLite WAL mode.

---

## MCP Tools Reference

Agents interact with the system through MCP tools. All mutation tools require a `caller` parameter to identify the caller (e.g., `"agent:cody"`).

### Task Management

#### `task_create` — Create a task

| Parameter | Type | Required | Description |
|-----------|------|----------|-------------|
| `title` | string | ✅ | Task title |
| `description` | string | | Detailed description |
| `assigned_to` | string | ✅ | Assignee (`boss` / `agent:{name}`) |
| `quadrant` | enum | | Eisenhower matrix quadrant |
| `deadline` | string | | Deadline (ISO 8601) |
| `parent_task_id` | string | | Parent task ID (for sub-tasks) |
| `caller` | string | ✅ | Caller identity |

**Quadrant options:**
- `urgent_important` — Do it now
- `not_urgent_important` — Schedule it
- `urgent_not_important` — Delegate it
- `not_urgent_not_important` — Drop or defer (default)

#### `task_update` — Update a task

| Parameter | Type | Required | Description |
|-----------|------|----------|-------------|
| `task_id` | string | ✅ | Task ID |
| `status` | enum | | New status |
| `title` | string | | New title |
| `description` | string | | New description |
| `quadrant` | enum | | New quadrant |
| `deadline` | string\|null | | New deadline |
| `assigned_to` | string | | New assignee |
| `caller` | string | ✅ | Caller identity |

**Permission rules:**
- Boss-created tasks → Agents can modify `status`, `title`, and `description`; cannot delete or change other fields
- Self-created tasks → Full CRUD for the creating agent
- Other agents' tasks → Cannot modify

**Status transitions:**
```
pending → in_progress → blocked (waiting for reply)
                      → review (submit for review)
blocked → in_progress (auto-resume when boss replies)
review  → completed (boss approves)
        → in_progress (boss rejects + feedback)
completed → archived
```

#### `task_list` — List tasks

| Parameter | Type | Required | Description |
|-----------|------|----------|-------------|
| `status` | string | | Filter by status |
| `assigned_to` | string | | Filter by assignee |
| `created_by` | string | | Filter by creator |
| `quadrant` | string | | Filter by quadrant |

#### `task_get` — Get task details

| Parameter | Type | Required | Description |
|-----------|------|----------|-------------|
| `task_id` | string | ✅ | Task ID |

**Returns:** Object with `task`, `subTasks`, `questions`, `reviews`, `auditLogs`

---

### Structured Questions

When agents need the boss's decision, they create structured questions. The boss answers via Web UI.

#### `question_create` — Create a question

| Parameter | Type | Required | Description |
|-----------|------|----------|-------------|
| `task_id` | string | | Related task ID |
| `question_type` | enum | ✅ | Question type |
| `question_text` | string | ✅ | Question content |
| `options` | string[] | | Options (choice types only) |
| `assigned_to` | string | ✅ | Responder (usually `boss`) |
| `caller` | string | ✅ | Asker identity |

**Question types:**
- `yes_no` — Yes/No binary choice
- `single_choice` — Single select (requires `options`)
- `multi_choice` — Multi select (requires `options`)
- `datetime` — Date/time picker
- `open_ended` — Free-text input

**Example:**
```json
{
  "task_id": "abc-123",
  "question_type": "single_choice",
  "question_text": "Should the meeting be on Wednesday or Thursday?",
  "options": ["Wednesday", "Thursday"],
  "assigned_to": "boss",
  "caller": "agent:cody"
}
```

#### `question_list` — List questions

| Parameter | Type | Required | Description |
|-----------|------|----------|-------------|
| `status` | string | | `pending` or `answered` |
| `assigned_to` | string | | Filter by responder |
| `created_by` | string | | Filter by asker |

#### `question_get_answer` — Get answer

| Parameter | Type | Required | Description |
|-----------|------|----------|-------------|
| `question_id` | string | ✅ | Question ID |

Agents can poll this tool to check if the boss has responded.

---

### Review & Feedback

#### `review_list` — List tasks pending review

| Parameter | Type | Required | Description |
|-----------|------|----------|-------------|
| `agent_id` | string | | Filter by agent |

#### `review_get` — Get review result

| Parameter | Type | Required | Description |
|-----------|------|----------|-------------|
| `task_id` | string | ✅ | Task ID |

#### `feedback_history` — Get historical feedback

| Parameter | Type | Required | Description |
|-----------|------|----------|-------------|
| `agent_id` | string | | Filter by agent |
| `limit` | number | | Max results (default 20) |

Useful for learning boss preferences and avoiding repeated mistakes.

---

### System Information

#### `dashboard` — Overview

| Parameter | Type | Required | Description |
|-----------|------|----------|-------------|
| `agent_id` | string | | Filter by agent |

**Response example:**
```json
{
  "pending_tasks": 3,
  "in_progress_tasks": 2,
  "blocked_tasks": 1,
  "review_tasks": 1,
  "unanswered_questions": 2,
  "newly_answered_questions": 1,
  "most_urgent": {
    "task_id": "...",
    "title": "Prepare quarterly report",
    "deadline": "2026-04-09T10:00:00Z"
  },
  "items_waiting_for_boss": [
    { "type": "question", "id": "...", "waiting_since": "2026-04-08T02:00:00Z" },
    { "type": "review", "id": "...", "task_id": "...", "waiting_since": "2026-04-08T01:30:00Z" }
  ]
}
```

Agents should call `dashboard` at the start of each session to sync state.

#### `audit_log` — Task change history

| Parameter | Type | Required | Description |
|-----------|------|----------|-------------|
| `task_id` | string | ✅ | Task ID |

---

## Agent Usage Guide

### Initialization Flow

1. Call `dashboard` to get the overview
2. Check `items_waiting_for_boss` for items waiting too long
3. Check `newly_answered_questions > 0`, use `question_list` for details
4. Process pending tasks

### Task Lifecycle

```
1. task_create → Create task (status: pending)
2. task_update → Start working (status: in_progress)
3. Need boss decision → question_create + task_update(status: blocked)
4. Poll question_get_answer for replies
5. Done → task_update(status: review)
6. Poll review_get for boss review
7. If rejected → Read feedback, fix, resubmit
```

### Reminder Strategy (Suggested)

| Wait Time | Suggested Action |
|-----------|------------------|
| < 2 hours | Don't remind |
| 2-6 hours | Gentle reminder |
| 6-24 hours | Clear "waiting" notice |
| > 24 hours | High priority alert |

---

## Web UI

The boss (human) interface provides:

- **Inbox** — Pending questions + tasks awaiting review, with inline actions and expandable descriptions
- **Kanban Board** — 4 columns (Pending / In Progress / Review / Completed)
- **Task Detail** — Sub-tasks, questions, feedback, full audit timeline
- **Create Task** — Assign to agent, set quadrant & deadline
- **PWA Support** — Add to home screen for native app-like experience
- **Pull-to-Refresh** — Pull down at the top to reload data

UI language: Traditional Chinese (i18n planned for Phase 2). Responsive layout for Mobile / Tablet / Desktop.

### Add to Home Screen

1. Open `http://your-server:3847` in your mobile browser
2. **iOS Safari**: Tap Share → "Add to Home Screen"
3. **Android Chrome**: Tap Menu → "Install app" or "Add to Home Screen"

---

## CLI Reference

```
agent-task-board start    [--port 3847]              Start Web UI
agent-task-board mcp                                 Start MCP Server (stdio)
agent-task-board config                              Output MCP config JSON
agent-task-board service  [install|uninstall|status]  System service management
```

---

## Data Storage

- Default path: `~/.agent-task-board/data.db` (SQLite)
- Custom path: env var `ATB_DB_PATH` or `--db-path` flag
- Service logs: `~/.agent-task-board/logs/`
- Backup = copy the `.db` file

---

## Development

```bash
git clone <repo-url>
cd agent-task-board
npm install              # Install deps + auto-build

npm run dev              # Backend watch mode
npm run dev:web          # Frontend Vite dev server (proxies /api → localhost:3847)
npm run build            # Full build
npm start                # Start server
```

## License

MIT
