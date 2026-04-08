import { statusLabel } from "../i18n";
import type { Task, TaskStatus } from "../types";
import TaskCard from "./TaskCard";

const COLUMNS: { status: TaskStatus; color: string; dot: string }[] = [
  { status: "pending", color: "var(--color-status-pending)", dot: "bg-amber-400" },
  { status: "in_progress", color: "var(--color-status-progress)", dot: "bg-blue-500" },
  { status: "review", color: "var(--color-status-review)", dot: "bg-purple-500" },
  { status: "completed", color: "var(--color-status-done)", dot: "bg-emerald-500" },
];

export default function KanbanBoard({ tasks }: { tasks: Task[] }) {
  return (
    <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-3 sm:gap-4">
      {COLUMNS.map(({ status, dot }) => {
        const columnTasks = tasks.filter((t) => t.status === status);
        return (
          <div key={status} className="min-h-[120px]">
            {/* Column header */}
            <div className="flex items-center gap-2 mb-3 px-1">
              <div className={`w-2 h-2 rounded-full ${dot}`} />
              <span className="text-xs font-semibold text-[var(--color-ink-muted)] uppercase tracking-wider">
                {statusLabel(status)}
              </span>
              <span className="text-xs text-[var(--color-ink-faint)] tabular-nums">
                {columnTasks.length}
              </span>
            </div>

            {/* Cards */}
            <div className="space-y-2">
              {columnTasks.map((task, i) => (
                <div key={task.id} className="animate-slide-up" style={{ animationDelay: `${i * 30}ms` }}>
                  <TaskCard task={task} />
                </div>
              ))}
              {columnTasks.length === 0 && (
                <div className="rounded-[var(--radius-md)] border border-dashed border-[var(--color-border)] py-6 text-center">
                  <span className="text-xs text-[var(--color-ink-faint)]">—</span>
                </div>
              )}
            </div>
          </div>
        );
      })}
    </div>
  );
}
