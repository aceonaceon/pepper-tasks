import { useState, useCallback } from "react";
import { usePolling } from "../hooks/usePolling";
import * as api from "../api";
import { t, statusLabel } from "../i18n";
import Inbox from "./Inbox";
import KanbanBoard from "./KanbanBoard";
import CalendarView from "./CalendarView";
import CreateTaskModal from "./CreateTaskModal";
import PullToRefresh from "./PullToRefresh";
import type { Task, Question } from "../types";

type ViewMode = "kanban" | "calendar";

export default function Home() {
  const [showCreate, setShowCreate] = useState(false);
  const [boardOpen, setBoardOpen] = useState(false);
  const [viewMode, setViewMode] = useState<ViewMode>("kanban");

  const fetchAll = useCallback(async () => {
    const [dashboard, tasks, questions] = await Promise.all([
      api.fetchDashboard(),
      api.fetchTasks(),
      api.fetchQuestions({ status: "pending", assigned_to: "boss" }),
    ]);
    return { dashboard, tasks, questions };
  }, []);

  const { data, refresh } = usePolling(fetchAll);

  const tasks = data?.tasks ?? [];
  const pendingQuestions = data?.questions ?? [];
  const reviewTasks = tasks.filter((t) => t.status === "review");

  // Status summary for collapsed board header
  const statusCounts = tasks.reduce(
    (acc, t) => {
      if (t.status in acc) acc[t.status as keyof typeof acc]++;
      return acc;
    },
    { pending: 0, in_progress: 0, review: 0, completed: 0 } as Record<string, number>
  );

  return (
    <PullToRefresh onRefresh={refresh}>
      <div className="space-y-6">
        {/* Inbox */}
        <section className="animate-slide-up">
          <Inbox
            questions={pendingQuestions}
            reviewTasks={reviewTasks}
            onAction={refresh}
          />
        </section>

        {/* Task Board — collapsible */}
        <section className="animate-slide-up" style={{ animationDelay: "50ms" }}>
          {/* Board header */}
          <div className="flex items-center justify-between mb-3">
            <button
              onClick={() => setBoardOpen(!boardOpen)}
              className="flex items-center gap-2 cursor-pointer group"
            >
              <svg
                width="14" height="14" viewBox="0 0 14 14" fill="none"
                className={`text-[var(--color-ink-faint)] transition-transform duration-200 ${boardOpen ? "rotate-90" : ""}`}
              >
                <path d="M4 2l5 5-5 5" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round"/>
              </svg>
              <h2 className="text-base font-semibold text-[var(--color-ink)] group-hover:text-[var(--color-accent)] transition-colors">
                {t.kanban}
              </h2>
              {!boardOpen && (
                <div className="flex items-center gap-1.5 ml-2">
                  <StatusDot color="bg-amber-400" count={statusCounts.pending} />
                  <StatusDot color="bg-blue-500" count={statusCounts.in_progress} />
                  <StatusDot color="bg-purple-500" count={statusCounts.review} />
                  <StatusDot color="bg-emerald-500" count={statusCounts.completed} />
                </div>
              )}
            </button>

            <div className="flex items-center gap-2">
              {boardOpen && (
                <div className="flex bg-[var(--color-surface-sunken)] rounded-[var(--radius-sm)] p-0.5">
                  <TabBtn active={viewMode === "kanban"} onClick={() => setViewMode("kanban")}>看板</TabBtn>
                  <TabBtn active={viewMode === "calendar"} onClick={() => setViewMode("calendar")}>日曆</TabBtn>
                </div>
              )}
              <button
                onClick={() => setShowCreate(true)}
                className="inline-flex items-center gap-1.5 px-3.5 py-1.5 bg-[var(--color-accent)] text-white rounded-[var(--radius-full)] text-sm font-medium hover:brightness-110 active:scale-[0.97] transition-all cursor-pointer"
              >
                <svg width="14" height="14" viewBox="0 0 14 14" fill="none">
                  <path d="M7 1v12M1 7h12" stroke="currentColor" strokeWidth="2" strokeLinecap="round"/>
                </svg>
                {t.create}
              </button>
            </div>
          </div>

          {/* Board content */}
          {boardOpen && (
            <div className="animate-slide-up">
              {viewMode === "kanban" ? (
                <KanbanBoard tasks={tasks} />
              ) : (
                <CalendarView tasks={tasks} />
              )}
            </div>
          )}
        </section>

        {showCreate && (
          <CreateTaskModal
            onClose={() => setShowCreate(false)}
            onCreated={() => { setShowCreate(false); refresh(); }}
          />
        )}
      </div>
    </PullToRefresh>
  );
}

function StatusDot({ color, count }: { color: string; count: number }) {
  if (count === 0) return null;
  return (
    <span className="inline-flex items-center gap-0.5">
      <span className={`w-2 h-2 rounded-full ${color}`} />
      <span className="text-[11px] text-[var(--color-ink-faint)] tabular-nums">{count}</span>
    </span>
  );
}

function TabBtn({ active, onClick, children }: { active: boolean; onClick: () => void; children: React.ReactNode }) {
  return (
    <button
      onClick={onClick}
      className={`px-3 py-1 rounded-[6px] text-xs font-medium transition-all cursor-pointer ${
        active
          ? "bg-[var(--color-surface-raised)] text-[var(--color-ink)] shadow-sm"
          : "text-[var(--color-ink-muted)] hover:text-[var(--color-ink)]"
      }`}
    >
      {children}
    </button>
  );
}
