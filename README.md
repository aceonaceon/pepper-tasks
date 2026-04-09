# 🌶️ Pepper Tasks

[English](README.en.md)

人與 AI Agent 之間的雙向任務協作面板 — 老闆與秘書的數位溝通介面。

> **為什麼叫 Pepper？**
>
> 名字來自《鋼鐵人》裡的 Pepper Potts。她從 Tony Stark 的秘書做起，隨著 Tony 越來越依賴她，Pepper 從助理升為公司 CEO，最終掌管了整個 Stark Industries。
>
> 這正是我們與 AI Agent 的未來關係 — Agent 從幫你處理瑣事開始，逐漸承擔更多責任，直到有一天，它們成為你的小公司或個人品牌的 CEO。而你，就像 Tony Stark 一樣，可以又有錢又很廢。🌶️

解決兩個核心問題：
1. **任務遺忘** — Agent session 結束後任務消失，沒有持久記錄
2. **回覆遺忘** — Agent 提出問題等待決策，但訊息被沖掉，人忘了回覆

---

## 快速開始

```bash
git clone <repo-url>
cd pepper-tasks
npm install          # 自動安裝所有依賴 + 建置前後端
npm start            # http://localhost:3847
```

需要 Node.js >= 18。`npm install` 會自動完成所有建置，不需手動執行其他步驟。

---

## 連接 MCP（供 AI Agent 使用）

**自動生成設定（推薦）：**

```bash
pepper-tasks config
```

將輸出的 JSON 複製到你的 MCP 設定中：

```json
{
  "mcpServers": {
    "task-board": {
      "command": "/path/to/node",
      "args": ["/path/to/pepper-tasks/dist/cli.js", "mcp"]
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
      "command": "pepper-tasks",
      "args": ["mcp"]
    }
  }
}
```

---

## 註冊為系統服務

讓 Agent Task Board 在開機時自動啟動：

```bash
pepper-tasks service install     # 註冊並啟動
pepper-tasks service status      # 查看狀態
pepper-tasks service uninstall   # 移除服務
```

| 平台 | 機制 | 設定位置 |
|------|------|----------|
| macOS | LaunchAgent | `~/Library/LaunchAgents/com.pepper-tasks.plist` |
| Linux | systemd user service | `~/.config/systemd/user/pepper-tasks.service` |

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

## Agent 自主工作協議（Skill）

Pepper Tasks 附帶一份 Agent 行為協議，讓 Agent 拿到任何指令後自動走完「研究 → 拆解 → 執行 → 彙報」的完整流程。

📄 **完整協議：** [`skills/agent-workflow/SKILL.md`](./skills/agent-workflow/SKILL.md)

### 核心概念

> 老闆說一句，Agent 做十步。給決策，不給問題。
> pepper-tasks 是 Agent 的跨 session 持久記憶層——每次寫入是存檔，每次啟動是讀檔。

安裝 Pepper Tasks 後，將 `skills/agent-workflow/SKILL.md` 加入你的 Agent 的 system prompt 或 skill 目錄中：

**Claude Code：**
```bash
# 將 SKILL.md 放入專案的 .claude/skills/ 目錄
cp pepper-tasks/skills/agent-workflow/SKILL.md your-project/.claude/skills/
```

**OpenClaw / 龍蝦：**
```
在 Agent 設定中，將 SKILL.md 的路徑加入 skills 清單
```

**其他 MCP 相容框架：**
將 SKILL.md 的內容作為 system prompt 的一部分注入即可。

### 協議做了什麼

| 階段 | Agent 行為 |
| --- | --- |
| 斷點續作 | 每次 session 啟動先掃描未完成任務，從 checkpoint 接手 |
| 接收指令 | 解析意圖，建立主任務，不問 open question |
| 自主研究 | 用 web search + 檔案讀寫收集資訊，建立研究子任務 |
| 任務拆解 | 拆成 3-5 個子任務，分配象限與優先級 |
| 逐步執行 | 每完成一步寫回 checkpoint，卡住才建結構化問題 |
| 彙整報告 | 提交報告 + 1-3 個決策點供老闆選擇 |
| 覆核回應 | 根據 feedback 修正並學習老闆偏好 |

### 設定定時輪詢（Heartbeat）

Agent 不會自己醒來。如果沒有定時任務，老闆回覆了問題、覆核了任務，Agent 也不知道——直到有人手動開 session。

**建議在安裝 Pepper Tasks 後，讓 Agent 設定一個定時任務（cron / heartbeat），定期啟動並執行 Phase 0（狀態同步與斷點續作）。**

這樣 Agent 就能：
- 自動發現老闆已回覆的問題，繼續被阻塞的任務
- 自動發現老闆已覆核的任務，執行後續行動或處理退回
- 自動撿起上一個 session 中斷的未完成工作
- 確保所有任務最終都推到老闆端（`blocked` / `review` / `completed`）

**cron 範例（每 30 分鐘輪詢一次）：**
```bash
*/30 * * * * cd /path/to/your-project && your-agent-cli run --skill agent-workflow --phase 0
```

**n8n / 自動化平台：**
設定一個 Schedule Trigger，每 30 分鐘觸發 Agent 執行一次 Phase 0。Agent 會自動判斷是否有待處理的工作，沒有就結束，有就繼續推進。

**OpenClaw / 龍蝦：**
在 Agent 設定中啟用 heartbeat 功能，設定輪詢間隔。Agent 每次被喚醒時會自動執行 Phase 0。

> **輪詢頻率建議：** 一般場景 30 分鐘一次即可。如果你的任務時效性高（如客服回覆、交易決策），可以縮短到 5-10 分鐘。頻率越高，Agent 的回應越即時，但消耗的 token 也越多。

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
pepper-tasks start    [--port 3847]              啟動 Web UI
pepper-tasks mcp                                 啟動 MCP Server（stdio）
pepper-tasks config                              輸出 MCP 設定 JSON
pepper-tasks service  [install|uninstall|status]  系統服務管理
```

---

## 資料儲存

- 預設路徑：`~/.pepper-tasks/data.db`（SQLite）
- 自訂路徑：環境變數 `ATB_DB_PATH` 或 `--db-path` 參數
- 服務日誌：`~/.pepper-tasks/logs/`
- 備份 = 複製 `.db` 檔案

---

## 開發

```bash
git clone <repo-url>
cd pepper-tasks
npm install              # 安裝依賴 + 自動建置

npm run dev              # 後端 watch mode
npm run dev:web          # 前端 Vite dev server（proxy /api → localhost:3847）
npm run build            # 完整建置
npm start                # 啟動
```

## License

MIT
