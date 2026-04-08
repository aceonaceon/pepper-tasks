export const t = {
  // Status
  pending: "待處理",
  in_progress: "進行中",
  blocked: "被阻塞",
  review: "待覆核",
  completed: "已完成",
  archived: "已歸檔",

  // Quadrants
  urgent_important: "緊急且重要",
  not_urgent_important: "重要不緊急",
  urgent_not_important: "緊急不重要",
  not_urgent_not_important: "不緊急不重要",

  // Sections
  inbox: "需要你處理",
  kanban: "任務看板",
  agentStatus: "Agent 動態",

  // Actions
  approve: "確認 OK",
  reject: "需修改",
  submit: "送出",
  create: "建立任務",
  cancel: "取消",
  yes: "是",
  no: "否",

  // Labels
  title: "標題",
  description: "描述",
  assignedTo: "負責者",
  quadrant: "象限",
  deadline: "截止時間",
  feedback: "Feedback",
  feedbackPlaceholder: "請說明需要修改的地方...",
  noItems: "目前沒有需要處理的項目",
  waitingSince: "等待",
  taskDetail: "任務詳情",
  subTasks: "子任務",
  relatedQuestions: "相關問題",
  auditTimeline: "操作歷史",
  feedbackHistory: "Feedback 紀錄",
  appTitle: "Pepper Tasks",

  // Question types
  yes_no: "是/否",
  single_choice: "單選",
  multi_choice: "多選",
  datetime: "日期時間",
  open_ended: "開放式",
} as const;

export function statusLabel(status: string): string {
  return (t as Record<string, string>)[status] || status;
}

export function quadrantLabel(quadrant: string): string {
  return (t as Record<string, string>)[quadrant] || quadrant;
}

export function timeAgo(dateStr: string): string {
  const diff = Date.now() - new Date(dateStr).getTime();
  const minutes = Math.floor(diff / 60000);
  if (minutes < 60) return `${minutes} 分鐘`;
  const hours = Math.floor(minutes / 60);
  if (hours < 24) return `${hours} 小時`;
  const days = Math.floor(hours / 24);
  return `${days} 天`;
}
