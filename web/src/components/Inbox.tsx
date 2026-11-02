import { useState } from "react";
import { t, timeAgo } from "../i18n";
import type { Question, Task } from "../types";
import QuestionAnswer from "./QuestionAnswer";
import ReviewAction from "./ReviewAction";
import Markdown from "./Markdown";

interface Props {
  questions: Question[];
  reviewTasks: Task[];
  onAction: () => void;
}

export default function Inbox({ questions, reviewTasks, onAction }: Props) {
  const hasItems = questions.length > 0 || reviewTasks.length > 0;

  return (
    <div>
      <div className="flex items-center gap-2 mb-3">
        <h2 className="text-base font-semibold text-[var(--color-ink)]">
          {t.inbox}
        </h2>
        {hasItems && (
          <span className="inline-flex items-center justify-center min-w-5 h-5 px-1.5 bg-[var(--color-status-blocked)] text-white text-xs font-semibold rounded-[var(--radius-full)]">
            {questions.length + reviewTasks.length}
          </span>
        )}
      </div>

      {!hasItems && (
        <div className="bg-[var(--color-surface-raised)] rounded-[var(--radius-md)] border border-[var(--color-border)] p-8 text-center">
          <div className="text-3xl mb-2">✨</div>
          <p className="text-sm text-[var(--color-ink-muted)]">{t.noItems}</p>
        </div>
      )}

      <div className="space-y-3">
        {questions.map((q, i) => (
          <InboxCard
            key={q.id}
            icon="❓"
            iconBg="bg-amber-100"
            meta={`${q.created_by} 問你`}
            title={q.question_text}
            description={q.description}
            waitingSince={q.created_at}
            delay={i * 40}
          >
            <QuestionAnswer question={q} onAnswered={onAction} />
          </InboxCard>
        ))}

        {reviewTasks.map((task, i) => (
          <InboxCard
            key={task.id}
            icon="📋"
            iconBg="bg-purple-100"
            meta={`${task.assigned_to} 完成了`}
            title={task.title}
            description={task.description}
            waitingSince={task.updated_at}
            delay={(questions.length + i) * 40}
          >
            <ReviewAction task={task} onReviewed={onAction} />
          </InboxCard>
        ))}
      </div>
    </div>
  );
}

function InboxCard({
  icon,
  iconBg,
  meta,
  title,
  description,
  waitingSince,
  delay,
  children,
}: {
  icon: string;
  iconBg: string;
  meta: string;
  title: string;
  description: string | null;
  waitingSince: string;
  delay: number;
  children: React.ReactNode;
}) {
  const [expanded, setExpanded] = useState(false);
  const hasDesc = description && description.trim().length > 0;

  return (
    <div
      className="animate-slide-up bg-[var(--color-surface-raised)] rounded-[var(--radius-md)] border border-[var(--color-border)] p-4 shadow-[var(--shadow-card)] hover:shadow-[var(--shadow-card-hover)] transition-shadow"
      style={{ animationDelay: `${delay}ms` }}
    >
      <div className="flex items-start justify-between gap-3 mb-2">
        <div className="flex items-start gap-2.5 min-w-0">
          <span className={`shrink-0 w-7 h-7 rounded-full ${iconBg} flex items-center justify-center text-sm`}>
            {icon}
          </span>
          <div className="min-w-0">
            <span className="text-xs text-[var(--color-ink-faint)]">{meta}</span>
            <p className="text-sm font-medium text-[var(--color-ink)] leading-snug">{title}</p>
          </div>
        </div>
        <span className="shrink-0 text-[11px] text-[var(--color-ink-faint)] tabular-nums whitespace-nowrap">
          {timeAgo(waitingSince)}
        </span>
      </div>

      {/* Expandable description */}
      {hasDesc && (
        <div className="ml-[38px] mb-3">
          <button
            onClick={() => setExpanded(!expanded)}
            className="inline-flex items-center gap-1 text-xs text-[var(--color-accent)] hover:text-[var(--color-accent)]/80 transition-colors cursor-pointer"
          >
            <svg
              width="12"
              height="12"
              viewBox="0 0 12 12"
              fill="none"
              className={`transition-transform duration-200 ${expanded ? "rotate-90" : ""}`}
            >
              <path d="M4 2l4 4-4 4" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round"/>
            </svg>
            {expanded ? t.collapseDesc : t.expandDesc}
          </button>
          {expanded && (
            <div className="mt-2 bg-[var(--color-surface-sunken)] rounded-[var(--radius-sm)] p-3 animate-slide-up">
              <Markdown>{description!}</Markdown>
            </div>
          )}
        </div>
      )}

      <div className={hasDesc ? "ml-[38px]" : ""}>{children}</div>
    </div>
  );
}
