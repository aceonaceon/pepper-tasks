import { useState, useMemo } from "react";
import { Link } from "react-router-dom";
import { statusLabel } from "../i18n";
import type { Task } from "../types";

const WEEKDAYS = ["日", "一", "二", "三", "四", "五", "六"];

function getDaysInMonth(year: number, month: number): number {
  return new Date(year, month + 1, 0).getDate();
}

function getFirstDayOfWeek(year: number, month: number): number {
  return new Date(year, month, 1).getDay();
}

function toDateKey(d: Date): string {
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(d.getDate()).padStart(2, "0")}`;
}

function parseDeadline(deadline: string): Date | null {
  const d = new Date(deadline);
  return isNaN(d.getTime()) ? null : d;
}

const STATUS_DOT: Record<string, string> = {
  pending: "bg-amber-400",
  in_progress: "bg-blue-500",
  blocked: "bg-red-500",
  review: "bg-purple-500",
  completed: "bg-emerald-500",
};

export default function CalendarView({ tasks }: { tasks: Task[] }) {
  const today = new Date();
  const [year, setYear] = useState(today.getFullYear());
  const [month, setMonth] = useState(today.getMonth());
  const [selectedDate, setSelectedDate] = useState<string | null>(null);

  const tasksByDate = useMemo(() => {
    const map: Record<string, Task[]> = {};
    for (const task of tasks) {
      if (!task.deadline) continue;
      const d = parseDeadline(task.deadline);
      if (!d) continue;
      const key = toDateKey(d);
      if (!map[key]) map[key] = [];
      map[key].push(task);
    }
    return map;
  }, [tasks]);

  const daysInMonth = getDaysInMonth(year, month);
  const firstDay = getFirstDayOfWeek(year, month);
  const todayKey = toDateKey(today);

  const prevMonth = () => {
    if (month === 0) { setYear(year - 1); setMonth(11); }
    else setMonth(month - 1);
    setSelectedDate(null);
  };

  const nextMonth = () => {
    if (month === 11) { setYear(year + 1); setMonth(0); }
    else setMonth(month + 1);
    setSelectedDate(null);
  };

  const goToday = () => {
    setYear(today.getFullYear());
    setMonth(today.getMonth());
    setSelectedDate(todayKey);
  };

  const selectedTasks = selectedDate ? tasksByDate[selectedDate] || [] : [];

  return (
    <div className="space-y-3">
      {/* Month nav */}
      <div className="flex items-center justify-between">
        <button onClick={prevMonth} className="w-8 h-8 rounded-[var(--radius-sm)] bg-[var(--color-surface-sunken)] hover:bg-[var(--color-border)] flex items-center justify-center transition-colors cursor-pointer text-[var(--color-ink-muted)]">
          ‹
        </button>
        <div className="flex items-center gap-2">
          <span className="text-sm font-semibold text-[var(--color-ink)]">
            {year} 年 {month + 1} 月
          </span>
          <button onClick={goToday} className="text-[11px] text-[var(--color-accent)] hover:underline cursor-pointer">今天</button>
        </div>
        <button onClick={nextMonth} className="w-8 h-8 rounded-[var(--radius-sm)] bg-[var(--color-surface-sunken)] hover:bg-[var(--color-border)] flex items-center justify-center transition-colors cursor-pointer text-[var(--color-ink-muted)]">
          ›
        </button>
      </div>

      {/* Calendar grid */}
      <div className="bg-[var(--color-surface-raised)] rounded-[var(--radius-md)] border border-[var(--color-border)] overflow-hidden shadow-[var(--shadow-card)]">
        {/* Weekday header */}
        <div className="grid grid-cols-7 border-b border-[var(--color-border)]">
          {WEEKDAYS.map((d) => (
            <div key={d} className="py-2 text-center text-[11px] font-medium text-[var(--color-ink-faint)] uppercase">
              {d}
            </div>
          ))}
        </div>

        {/* Days */}
        <div className="grid grid-cols-7">
          {/* Empty cells for offset */}
          {Array.from({ length: firstDay }).map((_, i) => (
            <div key={`e-${i}`} className="aspect-square border-b border-r border-[var(--color-border)]/50" />
          ))}

          {Array.from({ length: daysInMonth }).map((_, i) => {
            const day = i + 1;
            const dateKey = `${year}-${String(month + 1).padStart(2, "0")}-${String(day).padStart(2, "0")}`;
            const dayTasks = tasksByDate[dateKey] || [];
            const isToday = dateKey === todayKey;
            const isSelected = dateKey === selectedDate;

            return (
              <button
                key={day}
                onClick={() => setSelectedDate(isSelected ? null : dateKey)}
                className={`aspect-square border-b border-r border-[var(--color-border)]/50 p-1 flex flex-col items-center justify-start gap-0.5 transition-colors cursor-pointer
                  ${isSelected ? "bg-[var(--color-accent-soft)]" : "hover:bg-[var(--color-surface-sunken)]"}
                `}
              >
                <span className={`text-xs tabular-nums leading-none mt-0.5
                  ${isToday ? "w-5 h-5 flex items-center justify-center rounded-full bg-[var(--color-accent)] text-white font-bold" : "text-[var(--color-ink-muted)]"}
                  ${isSelected && !isToday ? "font-semibold text-[var(--color-accent)]" : ""}
                `}>
                  {day}
                </span>
                {dayTasks.length > 0 && (
                  <div className="flex gap-0.5 flex-wrap justify-center">
                    {dayTasks.slice(0, 3).map((t, j) => (
                      <div key={j} className={`w-1.5 h-1.5 rounded-full ${STATUS_DOT[t.status] || "bg-stone-400"}`} />
                    ))}
                    {dayTasks.length > 3 && (
                      <span className="text-[8px] text-[var(--color-ink-faint)]">+{dayTasks.length - 3}</span>
                    )}
                  </div>
                )}
              </button>
            );
          })}
        </div>
      </div>

      {/* Selected date tasks */}
      {selectedDate && (
        <div className="animate-slide-up space-y-2">
          <h3 className="text-xs font-semibold text-[var(--color-ink-muted)]">
            {selectedDate} — {selectedTasks.length} 筆任務
          </h3>
          {selectedTasks.length === 0 && (
            <p className="text-xs text-[var(--color-ink-faint)] text-center py-4">這天沒有任務</p>
          )}
          {selectedTasks.map((task) => (
            <Link
              key={task.id}
              to={`/tasks/${task.id}`}
              className="flex items-center gap-2.5 p-3 bg-[var(--color-surface-raised)] rounded-[var(--radius-sm)] border border-[var(--color-border)] hover:shadow-[var(--shadow-card-hover)] transition-shadow no-underline"
            >
              <div className={`w-2 h-2 rounded-full shrink-0 ${STATUS_DOT[task.status] || "bg-stone-400"}`} />
              <div className="flex-1 min-w-0">
                <p className="text-sm font-medium text-[var(--color-ink)] truncate">{task.title}</p>
                <span className="text-[11px] text-[var(--color-ink-faint)]">{statusLabel(task.status)} · {task.assigned_to}</span>
              </div>
            </Link>
          ))}
        </div>
      )}
    </div>
  );
}
