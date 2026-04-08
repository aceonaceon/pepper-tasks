# 🌶️ Pepper Tasks

[English](README.en.md)

人與 AI Agent 之間的雙向任務協作面板 — 老闆與秘書的數位溝通介面。

解決兩個核心問題：
1. **任務遺忘** — Agent session 結束後任務消失，沒有持久記錄
2. **回覆遺忘** — Agent 提出問題等待決策，但訊息被沖掉，人忘了回覆

---

## 快速開始

```bash
git clone <repo-url>
cd agent-task-board
npm install          # 自動安裝所有依賴 + 建置前後端
npm start            # http://localhost:3847
```

需要 Node.js >= 18。`npm install` 會自動完成所有建置，不需手動執行其他步驟。

---

## 連接 MCP（供 AI Agent 使用）

**自動生成設定（推薦）：**

```bash
agent-task-board config
```

將輸出的 JSON 複製到你的 MCP 設定中：

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

支援 Claude Code、OpenClaw（龍蝦）以及所有 MCP 相容的 Agent 框架。

> `config` 指令會自動偵測正確的 Node.js 路徑，避免多版本 Node（如 nvm）導致的 native addon 不匹配問題。即使版本不匹配，系統也會在啟動時自動重新編譯。

**手動設定（系統只有一個 Node）：**

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

## 註冊為系統服務

讓 Agent Task Board 在開機時自動啟動：

```bash
agent-task-board service install     # 註冊並啟動
agent-task-board service status      # 查看狀態
agent-task-board service uninstall   # 移除服務
```

| 平台 | 機制 | 設定位置 |
|------|------|----------|
| macOS | LaunchAgent | `~/Library/LaunchAgents/com.agent-task-board.plist` |
| Linux | systemd user service | `~/.config/systemd/user/agent-task-board.service` |

不需要 sudo，以使用者權限運行。支援 crash 後自動重啟。

---

## 架構概覽

```
┌──────────────────────────────────────┐
│         單一 Node.js Process          │
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
│         │  (.db 單檔)  │              │
│         └─────────────┘              │
└──────────────────────────────────────┘
     ↑ stdio           ↑ HTTP
     │                  │
  Agent              瀏覽器
(龍蝦/Claude Code)   (Web UI)
```

Web UI 和 MCP 是兩個獨立 process，透過 SQLite WAL mode 安全共享同一個資料庫檔案。

---

## MCP 工具完整規格

Agent 透過 MCP 工具與系統互動。所有修改類工具都需要 `caller` 參數來標識呼叫者身份（如 `"agent:cody"`）。

### 任務管理

#### `task_create` — 建立任務

| 參數 | 類型 | 必填 | 說明 |
|------|------|------|------|
| `title` | string | ✅ | 任務標題 |
| `description` | string | | 詳細描述 |
| `assigned_to` | string | ✅ | 負責者（`boss` / `agent:{name}`） |
| `quadrant` | enum | | 艾森豪象限（見下方） |
| `deadline` | string | | 截止時間（ISO 8601） |
| `parent_task_id` | string | | 父任務 ID（建立子任務用） |
| `caller` | string | ✅ | 呼叫者身份 |

**象限（quadrant）選項：**
- `urgent_important` — 緊急且重要（立即處理）
- `not_urgent_important` — 重要不緊急（規劃排程）
- `urgent_not_important` — 緊急不重要（考慮委派）
- `not_urgent_not_important` — 不緊急不重要（預設值）

#### `task_update` — 更新任務

| 參數 | 類型 | 必填 | 說明 |
|------|------|------|------|
| `task_id` | string | ✅ | 任務 ID |
| `status` | enum | | 新狀態 |
| `title` | string | | 新標題 |
| `description` | string | | 新描述 |
| `quadrant` | enum | | 新象限 |
| `deadline` | string\|null | | 新截止時間 |
| `assigned_to` | string | | 新負責者 |
| `caller` | string | ✅ | 呼叫者身份 |

**權限規則：**
- 老闆建立的任務 → Agent 可修改 `status`、`title`、`description`，不可刪除、不可更改其他欄位
- Agent 自建的任務 → 建立者擁有完全修改權限
- 其他 Agent 的任務 → 不可修改

**狀態流轉規則：**
```
pending → in_progress → blocked（等待回覆）
                      → review（提交覆核）
blocked → in_progress（老闆回覆後自動恢復）
review  → completed（老闆確認）
        → in_progress（老闆退回 + Feedback）
completed → archived
```

#### `task_list` — 查詢任務列表

| 參數 | 類型 | 必填 | 說明 |
|------|------|------|------|
| `status` | string | | 篩選狀態 |
| `assigned_to` | string | | 篩選負責者 |
| `created_by` | string | | 篩選建立者 |
| `quadrant` | string | | 篩選象限 |

#### `task_get` — 取得任務詳情

| 參數 | 類型 | 必填 | 說明 |
|------|------|------|------|
| `task_id` | string | ✅ | 任務 ID |

**回傳：** 包含 `task`、`subTasks`、`questions`、`reviews`、`auditLogs` 的完整物件

---

### 結構化提問

Agent 需要老闆決策時，建立結構化問題。老闆在 Web UI 中回答。

#### `question_create` — 建立問題

| 參數 | 類型 | 必填 | 說明 |
|------|------|------|------|
| `task_id` | string | | 關聯任務 ID |
| `question_type` | enum | ✅ | 問題類型 |
| `question_text` | string | ✅ | 問題內容 |
| `options` | string[] | | 選項（僅 choice 類型需要） |
| `assigned_to` | string | ✅ | 回答者（通常是 `boss`） |
| `caller` | string | ✅ | 提問者身份 |

**問題類型（question_type）：**
- `yes_no` — 是/否二選一
- `single_choice` — 單選（需提供 `options`）
- `multi_choice` — 多選（需提供 `options`）
- `datetime` — 日期時間選擇
- `open_ended` — 開放式文字回答

**範例：**
```json
{
  "task_id": "abc-123",
  "question_type": "single_choice",
  "question_text": "會議要約週三還是週四？",
  "options": ["週三", "週四"],
  "assigned_to": "boss",
  "caller": "agent:cody"
}
```

#### `question_list` — 查詢問題列表

| 參數 | 類型 | 必填 | 說明 |
|------|------|------|------|
| `status` | string | | `pending` 或 `answered` |
| `assigned_to` | string | | 篩選回答者 |
| `created_by` | string | | 篩選提問者 |

#### `question_get_answer` — 取得回答

| 參數 | 類型 | 必填 | 說明 |
|------|------|------|------|
| `question_id` | string | ✅ | 問題 ID |

Agent 可定時呼叫此工具，檢查老闆是否已回答問題。

---

### 覆核與 Feedback

#### `review_list` — 查詢待覆核任務

| 參數 | 類型 | 必填 | 說明 |
|------|------|------|------|
| `agent_id` | string | | 篩選特定 Agent |

#### `review_get` — 取得覆核結果

| 參數 | 類型 | 必填 | 說明 |
|------|------|------|------|
| `task_id` | string | ✅ | 任務 ID |

#### `feedback_history` — 查詢歷史 Feedback

| 參數 | 類型 | 必填 | 說明 |
|------|------|------|------|
| `agent_id` | string | | 篩選特定 Agent |
| `limit` | number | | 回傳筆數上限（預設 20） |

可用於學習老闆偏好、避免重複犯錯。

---

### 系統資訊

#### `dashboard` — 全貌概覽

| 參數 | 類型 | 必填 | 說明 |
|------|------|------|------|
| `agent_id` | string | | 篩選特定 Agent |

**回傳範例：**
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
    "title": "準備季度報告",
    "deadline": "2026-04-09T10:00:00Z"
  },
  "items_waiting_for_boss": [
    { "type": "question", "id": "...", "waiting_since": "2026-04-08T02:00:00Z" },
    { "type": "review", "id": "...", "task_id": "...", "waiting_since": "2026-04-08T01:30:00Z" }
  ]
}
```

Agent 每次 session 開始時應先呼叫 `dashboard` 同步狀態。

#### `audit_log` — 任務歷史變更紀錄

| 參數 | 類型 | 必填 | 說明 |
|------|------|------|------|
| `task_id` | string | ✅ | 任務 ID |

---

## Agent 使用建議

### 初始化流程

1. 呼叫 `dashboard` 取得全貌
2. 檢查 `items_waiting_for_boss` 是否有等待過久的項目
3. 檢查 `newly_answered_questions > 0`，透過 `question_list` 取得詳情
4. 處理待辦任務

### 任務生命週期

```
1. task_create → 建立任務（status: pending）
2. task_update → 開始處理（status: in_progress）
3. 若需要老闆決策 → question_create + task_update(status: blocked)
4. 定時 question_get_answer 檢查回覆
5. 完成後 → task_update(status: review)
6. 定時 review_get 檢查覆核結果
7. 若被退回 → 閱讀 feedback，修正後再次提交
```

### 提醒策略（建議）

| 等待時長 | 建議行為 |
|----------|----------|
| < 2 小時 | 不提醒 |
| 2-6 小時 | 溫和提醒一次 |
| 6-24 小時 | 明確標注等待中 |
| > 24 小時 | 高優先提醒 |

---

## Web UI

老闆（人類）的操作介面：

- **收件匣** — 待回覆問題 + 待覆核任務，可直接操作，含可折疊的詳細說明
- **看板** — 四欄 Kanban（待處理 / 進行中 / 待覆核 / 已完成）
- **任務詳情** — 子任務、問題、Feedback、完整操作歷史
- **建立任務** — 指定負責 Agent、象限、截止時間
- **PWA 支援** — 可加入手機主畫面，如同原生 App 使用
- **下拉重新整理** — 在頁面頂部下拉可重新載入資料

介面語言為繁體中文。支援 Mobile / Tablet / Desktop 響應式佈局。

### 安裝到手機主畫面

1. 用手機瀏覽器開啟 `http://your-server:3847`
2. **iOS Safari**：點分享按鈕 →「加入主畫面」
3. **Android Chrome**：點選單 →「安裝應用程式」或「加入主畫面」

---

## CLI 完整指令

```
agent-task-board start    [--port 3847]              啟動 Web UI
agent-task-board mcp                                 啟動 MCP Server（stdio）
agent-task-board config                              輸出 MCP 設定 JSON
agent-task-board service  [install|uninstall|status]  系統服務管理
```

---

## 資料儲存

- 預設路徑：`~/.agent-task-board/data.db`（SQLite）
- 自訂路徑：環境變數 `ATB_DB_PATH` 或 `--db-path` 參數
- 服務日誌：`~/.agent-task-board/logs/`
- 備份 = 複製 `.db` 檔案

---

## 開發

```bash
git clone <repo-url>
cd agent-task-board
npm install              # 安裝依賴 + 自動建置

npm run dev              # 後端 watch mode
npm run dev:web          # 前端 Vite dev server（proxy /api → localhost:3847）
npm run build            # 完整建置
npm start                # 啟動
```

## License

MIT
