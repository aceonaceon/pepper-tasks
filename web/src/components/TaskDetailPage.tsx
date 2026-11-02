import { useCallback } from "react";
import { useParams, Link } from "react-router-dom";
import { usePolling } from "../hooks/usePolling";
import * as api from "../api";
import { t, statusLabel, quadrantLabel } from "../i18n";
import AuditTimeline from "./AuditTimeline";
import Markdown from "./Markdown";
import type { TaskDetail } from "../types";

const STATUS_DOTS: Record<string, string> = {
  pending: "bg-amber-400",
  in_progress: "bg-blue-500",
  blocked: "bg-red-500",
  review: "bg-purple-500",
  completed: "bg-emerald-500",
  archived: "bg-stone-400",
};

export default function TaskDetailPage() {
  const { id } = useParams<{ id: string }>();
  const fetchTask = useCallback(() => api.fetchTask(id!), [id]);
  const { data, loading, error } = usePolling<TaskDetail>(fetchTask, 5000);

  if (loading && !data) {
    return (
      <div className="flex items-center justify-center py-20">
        <div className="w-5 h-5 border-2 border-[var(--color-accent)] border-t-transparent rounded-full animate-spin" />
      </div>
    );
  }
  if (error) return <p className="text-red-500 p-4 text-sm">錯誤：{error}</p>;
  if (!data) return null;

  const { task, subTasks, questions, reviews, auditLogs } = data;

  return (
    <div className="space-y-6 animate-slide-up">
      {/* Task Header */}
      <div className="bg-[var(--color-surface-raised)] rounded-[var(--radius-lg)] border border-[var(--color-border)] p-5 sm:p-6 shadow-[var(--shadow-card)]">
        <h1 className="text-lg sm:text-xl font-bold text-[var(--color-ink)] leading-snug mb-3">
          {task.title}
        </h1>
        {task.description && (
          <div className="mb-4">
            <Markdown>{task.description}</Markdown>
          </div>
        )}
        <div className="flex flex-wrap gap-2">
          <Tag>
            <span className={`w-2 h-2 rounded-full ${STATUS_DOTS[task.status] || "bg-stone-400"}`} />
            {statusLabel(task.status)}
          </Tag>
          <Tag>{quadrantLabel(task.quadrant)}</Tag>
          <Tag>
            <span className="text-[var(--color-ink-faint)]">負責</span>
            <span className="font-mono">{task.assigned_to}</span>
          </Tag>
          <Tag>
            <span className="text-[var(--color-ink-faint)]">建立</span>
            <span className="font-mono">{task.created_by}</span>
          </Tag>
          {task.deadline && (
            <Tag>
              <span className="text-[var(--color-ink-faint)]">截止</span>
              {new Date(task.deadline).toLocaleString("zh-TW", { month: "short", day: "numeric", hour: "2-digit", minute: "2-digit" })}
            </Tag>
          )}
        </div>
      </div>

      {/* Sub-tasks */}
      {subTasks.length > 0 && (
        <Section title={t.subTasks} count={subTasks.length}>
          <div className="space-y-1.5">
            {subTasks.map((st) => (
              <Link
                key={st.id}
                to={`/tasks/${st.id}`}
                className="flex items-center gap-3 p-3 rounded-[var(--radius-sm)] hover:bg-[var(--color-surface-sunken)] transition-colors no-underline group"
              >
                <span className={`w-2 h-2 rounded-full shrink-0 ${STATUS_DOTS[st.status] || "bg-stone-400"}`} />
                <span className="text-sm text-[var(--color-ink)] group-hover:text-[var(--color-accent)] transition-colors flex-1 min-w-0 truncate">
                  {st.title}
                </span>
                <span className="text-[11px] text-[var(--color-ink-faint)] shrink-0">{statusLabel(st.status)}</span>
              </Link>
            ))}
          </div>
        </Section>
      )}

      {/* Questions */}
      {questions.length > 0 && (
        <Section title={t.relatedQuestions} count={questions.length}>
          <div className="space-y-2">
            {questions.map((q) => (
              <div key={q.id} className="p-3 rounded-[var(--radius-sm)] bg-[var(--color-surface-sunken)]">
                <p className="text-sm font-medium text-[var(--color-ink)] mb-1">{q.question_text}</p>
                {q.description && (
                  <div className="mb-2">
                    <Markdown>{q.description}</Markdown>
                  </div>
                )}
                <span className={`text-[11px] font-medium ${q.status === "answered" ? "text-emerald-600" : "text-amber-600"}`}>
                  {q.status === "answered" ? `✓ 已回答：${q.answer}` : "⏳ 等待回覆中..."}
                </span>
              </div>
            ))}
          </div>
        </Section>
      )}

      {/* Feedback */}
      {reviews.length > 0 && (
        <Section title={t.feedbackHistory} count={reviews.length}>
          <div className="space-y-2">
            {reviews.map((r) => (
              <div
                key={r.id}
                className={`p-3 rounded-[var(--radius-sm)] border-l-3 ${
                  r.approved
                    ? "bg-emerald-50/60 border-l-emerald-400"
                    : "bg-orange-50/60 border-l-orange-400"
                }`}
              >
                <div className="flex items-center gap-2 text-xs mb-1">
                  <span className="font-medium">{r.approved ? "✓ 通過" : "✕ 需修改"}</span>
                  <span className="text-[var(--color-ink-faint)] font-mono">{r.reviewer}</span>
                  <span className="text-[var(--color-ink-faint)] tabular-nums">
                    {new Date(r.created_at).toLocaleString("zh-TW", { month: "short", day: "numeric", hour: "2-digit", minute: "2-digit" })}
                  </span>
                </div>
                {r.comment && <p className="text-sm text-[var(--color-ink-muted)]">{r.comment}</p>}
              </div>
            ))}
          </div>
        </Section>
      )}

      {/* Audit Timeline */}
      <Section title={t.auditTimeline} count={auditLogs.length}>
        <AuditTimeline logs={auditLogs} />
      </Section>
    </div>
  );
}

function Tag({ children }: { children: React.ReactNode }) {
  return (
    <span className="inline-flex items-center gap-1.5 bg-[var(--color-surface-sunken)] text-[var(--color-ink-muted)] px-2.5 py-1 rounded-[var(--radius-full)] text-xs">
      {children}
    </span>
  );
}

function Section({ title, count, children }: { title: string; count?: number; children: React.ReactNode }) {
  return (
    <div className="bg-[var(--color-surface-raised)] rounded-[var(--radius-lg)] border border-[var(--color-border)] shadow-[var(--shadow-card)] overflow-hidden">
      <div className="px-5 py-3 border-b border-[var(--color-border)]">
        <h2 className="text-sm font-semibold text-[var(--color-ink)] flex items-center gap-2">
          {title}
          {count !== undefined && (
            <span className="text-[11px] text-[var(--color-ink-faint)] font-normal tabular-nums">{count}</span>
          )}
        </h2>
      </div>
      <div className="p-4 sm:p-5">{children}</div>
    </div>
  );
}
