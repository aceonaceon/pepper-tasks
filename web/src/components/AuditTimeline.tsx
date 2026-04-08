import type { AuditLog } from "../types";

const ACTION_META: Record<string, { label: string; icon: string; color: string }> = {
  created: { label: "建立任務", icon: "●", color: "text-emerald-500" },
  updated: { label: "更新任務", icon: "◆", color: "text-blue-500" },
  status_changed: { label: "狀態變更", icon: "→", color: "text-purple-500" },
  deleted: { label: "刪除任務", icon: "✕", color: "text-red-500" },
  reviewed: { label: "覆核", icon: "✓", color: "text-amber-500" },
  question_created: { label: "建立問題", icon: "?", color: "text-sky-500" },
  question_answered: { label: "回答問題", icon: "!", color: "text-teal-500" },
};

export default function AuditTimeline({ logs }: { logs: AuditLog[] }) {
  if (logs.length === 0) {
    return <p className="text-xs text-[var(--color-ink-faint)] text-center py-4">尚無操作紀錄</p>;
  }

  return (
    <div className="relative">
      {/* Vertical line */}
      <div className="absolute left-[11px] top-3 bottom-3 w-px bg-[var(--color-border)]" />

      <div className="space-y-0">
        {logs.map((log, i) => {
          const meta = ACTION_META[log.action] || { label: log.action, icon: "·", color: "text-stone-400" };
          return (
            <div
              key={log.id}
              className="relative flex gap-3 py-2.5 animate-fade-in"
              style={{ animationDelay: `${i * 20}ms` }}
            >
              {/* Dot */}
              <div className={`relative z-10 w-[22px] h-[22px] rounded-full bg-[var(--color-surface-raised)] border-2 border-[var(--color-border)] flex items-center justify-center text-[10px] font-bold shrink-0 ${meta.color}`}>
                {meta.icon}
              </div>

              {/* Content */}
              <div className="flex-1 min-w-0 pt-0.5">
                <div className="flex items-baseline gap-2 flex-wrap">
                  <span className="text-xs font-medium text-[var(--color-ink)]">{meta.label}</span>
                  <span className="text-[11px] text-[var(--color-ink-faint)] font-mono">{log.actor}</span>
                  <span className="text-[11px] text-[var(--color-ink-faint)] tabular-nums ml-auto shrink-0">
                    {new Date(log.timestamp).toLocaleString("zh-TW", {
                      month: "numeric", day: "numeric", hour: "2-digit", minute: "2-digit"
                    })}
                  </span>
                </div>
                {log.old_value && log.new_value && (
                  <p className="text-[11px] text-[var(--color-ink-faint)] mt-0.5 font-mono truncate">
                    {formatChange(log.old_value, log.new_value)}
                  </p>
                )}
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
}

function formatChange(oldVal: string, newVal: string): string {
  try {
    const o = JSON.parse(oldVal);
    const n = JSON.parse(newVal);
    if (typeof o === "string" && typeof n === "string") return `${o} → ${n}`;
    return `${JSON.stringify(o)} → ${JSON.stringify(n)}`;
  } catch {
    return `${oldVal} → ${newVal}`;
  }
}
