import { Link } from "react-router-dom";
import { quadrantLabel } from "../i18n";
import type { Task } from "../types";

const Q_STYLES: Record<string, string> = {
  urgent_important: "bg-[var(--color-q1)] text-[var(--color-q1-ink)]",
  not_urgent_important: "bg-[var(--color-q2)] text-[var(--color-q2-ink)]",
  urgent_not_important: "bg-[var(--color-q3)] text-[var(--color-q3-ink)]",
  not_urgent_not_important: "bg-[var(--color-q4)] text-[var(--color-q4-ink)]",
};

export default function TaskCard({ task }: { task: Task }) {
  return (
    <Link
      to={`/tasks/${task.id}`}
      className="block bg-[var(--color-surface-raised)] rounded-[var(--radius-md)] border border-[var(--color-border)] p-3.5 no-underline shadow-[var(--shadow-card)] hover:shadow-[var(--shadow-card-hover)] hover:border-[var(--color-ink-faint)] transition-all group"
    >
      <p className="text-[13px] font-medium text-[var(--color-ink)] leading-snug mb-1 group-hover:text-[var(--color-accent)] transition-colors line-clamp-2">
        {task.title}
      </p>
      {task.description && (
        <p className="text-[11px] text-[var(--color-ink-faint)] leading-snug mb-1.5 line-clamp-1">
          {task.description}
        </p>
      )}
      <div className="flex items-center gap-1.5 flex-wrap">
        <span className={`inline-block px-2 py-0.5 rounded-[var(--radius-full)] text-[11px] font-medium ${Q_STYLES[task.quadrant] || ""}`}>
          {quadrantLabel(task.quadrant)}
        </span>
        <span className="text-[11px] text-[var(--color-ink-faint)] font-mono">
          {task.assigned_to}
        </span>
        {task.deadline && (
          <span className="text-[11px] text-[var(--color-ink-faint)] tabular-nums">
            {new Date(task.deadline).toLocaleDateString("zh-TW", { month: "short", day: "numeric" })}
          </span>
        )}
      </div>
    </Link>
  );
}
