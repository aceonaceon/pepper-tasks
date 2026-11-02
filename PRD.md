# Agent Task Board — 產品需求文件（PRD）

> 版本：v1.0 | 日期：2026-04-08 | 撰寫：Cody（基於 Aceon 產品訪談整理）

---

## 1. 產品願景

### 一句話定位

**人與 AI Agent 之間的雙向任務協作面板 — 老闆與秘書的數位溝通介面。**

### 要解決的核心問題

在 Discord / Telegram / LINE 等訊息通道中，人與 Agent 的協作存在兩個致命的「遺忘」問題：

1. **任務遺忘** — 人交代了任務，但 Agent session 結束後任務就消失，沒有持久記錄
2. **回覆遺忘** — Agent 提出問題等待決策，但訊息被沖掉，人忘了回覆，任務卡住

這兩個問題對 ADHD 或注意力容易分散的用戶尤其嚴重 — 新訊息進來就去處理新的，手邊的事就被遺忘。

### 產品不是什麼

- 不是通用的專案管理工具（不是 Linear / Trello）
- 不是獨立的 SaaS 服務
- **是為 Agent 生態而生的基礎設施** — 服務對象是 OpenClaw（龍蝦）、Claude Code Discord Channel Plugin 等 Agent 框架的使用者

---

## 2. 目標用戶

### 主要用戶

- 使用 Discord / Telegram / LINE 與 AI Agent 協作的個人或小團隊
- 透過 OpenClaw（龍蝦）或 Claude Code 運行本地 Agent 的開發者 / 創業者
- 特別適合注意力容易分散、需要外部系統幫忙管理任務的用戶

### 用戶特徵

- 已在本地環境安裝 Node.js 和 Python（OpenClaw 依賴）
- 習慣透過訊息通道與 Agent 互動
- 需要結構化的方式追蹤任務，而非仰賴聊天記錄

---

## 3. 核心概念

### 老闆 ↔ 秘書模型

系統圍繞「老闆」與「秘書（Agent）」的雙向關係設計：

| 方向 | 場景 | 系統行為 |
|------|------|----------|
| 老闆 → Agent | 交代任務（透過 DM 或 Web UI） | Agent 結構化為待辦，記錄在系統中 |
| Agent → 老闆 | 需要決策（時間、選項、確認） | 建立結構化問題，老闆在 Web UI 回答 |
| Agent → 老闆 | 任務完成 | 標記待覆核，老闆確認或提供 Feedback |
| 雙向 | 追蹤進度 | 任務看板 + 審計時間軸，隨時可查 |

### 任務歸屬模型

每個任務具備兩個角色欄位：

- **`created_by`** — 建立者（`boss` / `agent:cody` / `agent:andrea` ...）
- **`assigned_to`** — 負責者（`boss` / `agent:cody` / ...）

歸屬範例：

| 場景 | created_by | assigned_to |
|------|-----------|-------------|
| 老闆交代 Cody 一個任務 | boss | agent:cody |
| Cody 自建的執行子任務 | agent:cody | agent:cody |
| Cody 請老闆回覆問題 | agent:cody | boss |
| 老闆自己的待辦提醒 | boss | boss |

### 權限模型

- **老闆建立的任務** → Agent 可修改狀態，**不可刪除**（防止 LLM 幻覺誤刪）
- **Agent 自建的子任務** → Agent 擁有完全 CRUD 權限
- **已完成的任務** → 歸檔而非刪除，可顯示/隱藏
- **所有變更** → 留下審計紀錄，不可篡改

---

## 4. 功能規格

### 4.1 任務管理

#### 任務欄位

| 欄位 | 類型 | 說明 |
|------|------|------|
| id | UUID | 唯一識別碼 |
| title | string | 任務標題 |
| description | string | 詳細描述 |
| created_by | string | 建立者（boss / agent:{name}） |
| assigned_to | string | 負責者 |
| status | enum | pending / in_progress / blocked / review / completed / archived |
| quadrant | enum | urgent_important / not_urgent_important / urgent_not_important / not_urgent_not_important |
| deadline | datetime | 截止時間（nullable） |
| parent_task_id | UUID | 父任務 ID（nullable，用於子任務） |
| created_at | datetime | 建立時間 |
| updated_at | datetime | 最後更新時間 |

#### 任務狀態流轉

```
pending（待處理）
    ↓
in_progress（進行中）
    ↓
├─ blocked（被阻塞 — 等待老闆回覆或外部依賴）
│      ↓（老闆回覆後）
│   in_progress
│      ↓
review（待覆核 — Agent 完成，等老闆確認）
    ↓
├─ completed（老闆確認 OK → 歸檔）
└─ in_progress（老闆不 OK → 附帶 Feedback，Agent 修正）
```

#### 艾森豪矩陣（四象限）

| 象限 | 標籤 | 說明 |
|------|------|------|
| Q1 | 緊急且重要 | 立即處理 |
| Q2 | 重要不緊急 | 規劃排程 |
| Q3 | 緊急不重要 | 考慮委派 |
| Q4 | 不緊急不重要 | 考慮刪除或延後 |

### 4.2 結構化提問

Agent 需要老闆決策時，透過 MCP 建立結構化問題。

#### 問題類型

| 類型 | 說明 | 回答方式 |
|------|------|----------|
| yes_no | 是或否 | 二選一按鈕 |
| single_choice | 單選 | 選項列表（Agent 提供選項） |
| multi_choice | 多選 | 複選框 |
| datetime | 日期/時間 | 日期時間選擇器 |
| open_ended | 開放式 | 文字輸入框 |

#### 問題欄位

| 欄位 | 類型 | 說明 |
|------|------|------|
| id | UUID | 唯一識別碼 |
| task_id | UUID | 關聯的任務（nullable） |
| created_by | string | 提問者（通常是 agent:{name}） |
| assigned_to | string | 回答者（通常是 boss） |
| question_type | enum | yes_no / single_choice / multi_choice / datetime / open_ended |
| question_text | string | 問題內容 |
| options | JSON | 選項列表（僅 choice 類型） |
| answer | JSON | 老闆的回答（nullable） |
| status | enum | pending / answered |
| created_at | datetime | 建立時間 |
| answered_at | datetime | 回答時間（nullable） |

### 4.3 覆核與 Feedback

#### 覆核流程

```
Agent 完成任務
    ↓
task.status → "review"
    ↓
老闆在 Web UI 看到待覆核任務
    ↓
├─ 確認 OK → task.status → "completed"
│            └─ 可選填正面 Feedback
└─ 不 OK → 填寫 Feedback（必填）
            ↓
           task.status → "in_progress"
           建立 revision 子任務，附帶 Feedback 內容
            ↓
           Agent 讀取 Feedback → 修正 → 再次提交覆核
```

#### Feedback 欄位

| 欄位 | 類型 | 說明 |
|------|------|------|
| id | UUID | 唯一識別碼 |
| task_id | UUID | 關聯任務 |
| reviewer | string | 覆核者（通常是 boss） |
| approved | boolean | 是否通過 |
| comment | string | Feedback 內容 |
| created_at | datetime | 覆核時間 |

#### Feedback 的學習價值

Agent 可透過 `feedback_history` API 查詢歷史 Feedback，用於：
- 了解老闆對特定類型任務的偏好
- 學習老闆偏好的處理方式、結果品質、語氣
- 避免重複犯同樣的錯誤

### 4.4 審計時間軸（Audit Trail）

每個任務都具備完整的時間軸紀錄：

| 欄位 | 類型 | 說明 |
|------|------|------|
| id | UUID | 唯一識別碼 |
| task_id | UUID | 關聯任務 |
| actor | string | 操作者（boss / agent:{name} / system） |
| action | string | 操作類型（created / status_changed / updated / reviewed / ...） |
| old_value | JSON | 變更前的值 |
| new_value | JSON | 變更後的值 |
| timestamp | datetime | 操作時間 |

---

## 5. MCP 工具規格

### 任務相關

| 工具名稱 | 說明 | 參數 |
|----------|------|------|
| `task_create` | 建立任務 | title, description, assigned_to, quadrant, deadline, parent_task_id |
| `task_update` | 更新任務（受權限控制） | task_id, status?, description?, quadrant?, deadline? |
| `task_list` | 查詢任務列表 | agent_id?, assigned_to?, status?, quadrant?, created_by? |
| `task_get` | 取得單一任務詳情 + 時間軸 | task_id |

### 提問相關

| 工具名稱 | 說明 | 參數 |
|----------|------|------|
| `question_create` | 建立結構化問題 | task_id?, question_type, question_text, options?, assigned_to |
| `question_list` | 查詢問題列表 | status?, assigned_to?, created_by? |
| `question_get_answer` | 取得回答 | question_id |

### 覆核相關

| 工具名稱 | 說明 | 參數 |
|----------|------|------|
| `review_list` | 查詢待覆核任務 | agent_id? |
| `review_get` | 取得覆核結果 + Feedback | task_id |
| `feedback_history` | 查詢歷史 Feedback | agent_id?, limit? |

### 系統資訊

| 工具名稱 | 說明 | 參數 |
|----------|------|------|
| `dashboard` | 全貌概覽 | agent_id? |
| `audit_log` | 任務歷史變更紀錄 | task_id |

### `dashboard` 回傳結構

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
    "title": "...",
    "deadline": "2026-04-09T10:00:00Z"
  },
  "items_waiting_for_boss": [
    { "type": "question", "id": "...", "waiting_since": "2026-04-08T02:00:00Z" },
    { "type": "review", "task_id": "...", "waiting_since": "2026-04-08T01:30:00Z" }
  ]
}
```

---

## 6. 通知與提醒機制

### 設計原則

- **Web App 是被動查詢層** — 不主動推送通知
- **Agent 負責拉取（Pull）** — 透過 MCP 定時呼叫 `dashboard` 檢查狀態
- **提醒時機由 Agent / 使用者自行決定** — 系統不規定，但提供足夠資訊

### 提醒升級建議（文件中說明，非強制實作）

系統提供每個待回覆項目的 `waiting_since` 時間戳，Agent 可據此自行判斷提醒策略：

| 等待時長 | 建議語氣 | 建議行為 |
|----------|----------|----------|
| < 2 小時 | 平和 | 不提醒 |
| 2-6 小時 | 溫和提醒 | 一次提醒 |
| 6-24 小時 | 明確提醒 | 標注等待中 |
| > 24 小時 | 強調緊急 | 高優先提醒 |

### 使用者須知（文件中明確說明）

1. 必須設定定時任務或 heartbeat 讓 Agent 呼叫 MCP，才能取得更新
2. 老闆在 Web UI 回覆後，Agent 不會即時收到通知
3. Agent session 開始時應先呼叫 `dashboard` 同步狀態

---

## 7. Web UI 規格

### 首頁佈局（收件匣 + 看板混合）

```
┌─────────────────────────────────────────────┐
│  Agent Task Board                    [設定]  │
├─────────────────────────────────────────────┤
│                                             │
│  📥 需要你處理（收件匣）                      │
│  ┌─────────────────────────────────────┐    │
│  │ ❓ Cody 問你：會議要約週三還是週四？   │    │
│  │    [週三] [週四]            等待 2h   │    │
│  ├─────────────────────────────────────┤    │
│  │ ✅ Andrea 完成：社群貼文草稿          │    │
│  │    [確認OK] [需修改]        等待 30m  │    │
│  ├─────────────────────────────────────┤    │
│  │ ❓ Mia 問你：預算上限是多少？         │    │
│  │    [________________] [送出]  等待 5h │    │
│  └─────────────────────────────────────┘    │
│                                             │
│  📋 任務看板                                 │
│  ┌──────┬──────┬──────┬──────┐              │
│  │待處理 │進行中 │待覆核 │已完成 │              │
│  │      │      │      │      │              │
│  │ ...  │ ...  │ ...  │ ...  │              │
│  └──────┴──────┴──────┴──────┘              │
│                                             │
│  🤖 Agent 動態                               │
│  ┌─────────────────────────────────────┐    │
│  │ Cody   ● 進行中 2 │ ⏳ 等你回覆 1   │    │
│  │ Andrea ● 進行中 1 │ ✅ 待覆核 1     │    │
│  │ Mia    ● 進行中 0 │ ⏳ 等你回覆 1   │    │
│  └─────────────────────────────────────┘    │
│                                             │
└─────────────────────────────────────────────┘
```

### 任務詳情頁

- 任務基本資訊（標題、描述、象限、截止時間、歸屬）
- 子任務列表
- 關聯問題列表
- 審計時間軸（完整操作歷史）
- Feedback 紀錄

### 語言

- 介面預設繁體中文
- 可擴展多語支援（Phase 2）

---

## 8. 技術架構

### 架構概覽

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

### 技術選型

| 層級 | 技術 | 理由 |
|------|------|------|
| Runtime | Node.js | OpenClaw 用戶已安裝，零額外依賴 |
| MCP Server | @modelcontextprotocol/sdk | 標準 MCP stdio 模式 |
| HTTP Server | Hono | 輕量、快速、TypeScript 原生 |
| 資料庫 | SQLite (better-sqlite3) | 單檔、無需額外服務、支援結構化查詢 |
| 前端 | React SPA（預打包靜態檔） | 由同一 Node process 靜態 serve |
| 打包 | tsup / esbuild | 快速打包 |

### 安裝與啟動

```bash
npm install -g agent-task-board

# 啟動服務
agent-task-board start
# → MCP Server ready (stdio)
# → Web UI at http://localhost:3847

# 或指定 port
agent-task-board start --port 4000
```

### MCP 設定（Claude Code / 龍蝦）

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

### 資料儲存

- 預設路徑：`~/.agent-task-board/data.db`
- 可透過環境變數或啟動參數自訂路徑
- 備份 = 複製 `.db` 檔案

### 遠端存取

使用者可透過以下方式從遠端存取 Web UI：
- Tailscale（推薦，零設定 VPN）
- Cloudflare Tunnel
- ngrok
- SSH tunnel

---

## 9. Phase 規劃

### Phase 1 — MVP

**目標：** 讓一個老闆和一個或多個 Agent 能透過結構化方式協作

- [ ] 單一 Node.js process（MCP Server + HTTP Server + SQLite）
- [ ] 任務 CRUD（含象限、截止時間、歸屬、權限控制）
- [ ] 任務狀態流轉（pending → in_progress → blocked → review → completed）
- [ ] 結構化提問（5 種類型：是否 / 單選 / 多選 / 日期 / 開放式）
- [ ] 覆核 + Feedback 流程
- [ ] 審計時間軸（所有變更紀錄）
- [ ] Web UI：收件匣 + 看板 + Agent 動態
- [ ] 完整 MCP 工具集（12 個工具）
- [ ] `npm install -g` 一鍵安裝
- [ ] 使用文件（含定時查詢機制說明）

### Phase 2 — 擴展

- [ ] 多 Agent 協作支援（Agent 之間的任務交接與依賴）
- [ ] Feedback 歷史分析（偏好摘要、趨勢）
- [ ] 任務模板 / 重複任務
- [ ] 多語支援
- [ ] 匯出報表（週報 / 月報）

---

## 10. 成功指標

| 指標 | 目標 |
|------|------|
| 任務遺忘率 | 從「經常忘記」降至「幾乎不忘」 |
| 問題回覆延遲 | 平均等待時間 < 4 小時 |
| Agent 覆核通過率 | 隨 Feedback 累積逐步提升 |
| 使用者主動打開 Web UI 的頻率 | 每天至少 1 次 |

---

*本文件基於 2026-04-08 Aceon × Cody PRD 訪談整理。*
