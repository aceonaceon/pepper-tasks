import { useState, useCallback } from "react";
import { usePolling } from "../hooks/usePolling";
import * as api from "../api";
import { t } from "../i18n";
import PullToRefresh from "./PullToRefresh";
import Inbox from "./Inbox";
import KanbanBoard from "./KanbanBoard";
import CreateTaskModal from "./CreateTaskModal";
import type { DashboardData, Task, Question } from "../types";

export default function Home() {
  const [showCreate, setShowCreate] = useState(false);

  const fetchAll = useCallback(async () => {
    const [dashboard, tasks, questions] = await Promise.all([
      api.fetchDashboard(),
      api.fetchTasks(),
      api.fetchQuestions({ status: "pending", assigned_to: "boss" }),
    ]);
    return { dashboard, tasks, questions };
  }, []);

  const { data, refresh } = usePolling(fetchAll);

  const dashboard = data?.dashboard ?? null;
  const tasks = data?.tasks ?? [];
  const pendingQuestions = data?.questions ?? [];
  const reviewTasks = tasks.filter((t) => t.status === "review");

  return (
    <PullToRefresh onRefresh={refresh}>
    <div className="space-y-8">
      {/* Stats Bar */}
      {dashboard && (
        <div className="animate-slide-up grid grid-cols-2 sm:grid-cols-4 gap-3">
          <StatPill label={t.pending} value={dashboard.pending_tasks} color="var(--color-status-pending)" />
          <StatPill label={t.in_progress} value={dashboard.in_progress_tasks} color="var(--color-status-progress)" />
          <StatPill label={t.blocked} value={dashboard.blocked_tasks} color="var(--color-status-blocked)" />
          <StatPill label={t.review} value={dashboard.review_tasks} color="var(--color-status-review)" />
        </div>
      )}

      {/* Inbox */}
      <section className="animate-slide-up" style={{ animationDelay: "50ms" }}>
        <Inbox
          questions={pendingQuestions}
          reviewTasks={reviewTasks}
          onAction={refresh}
        />
      </section>

      {/* Kanban */}
      <section className="animate-slide-up" style={{ animationDelay: "100ms" }}>
        <div className="flex items-center justify-between mb-4">
          <h2 className="text-base font-semibold text-[var(--color-ink)]">
            {t.kanban}
          </h2>
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
        <KanbanBoard tasks={tasks} />
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

function StatPill({ label, value, color }: { label: string; value: number; color: string }) {
  return (
    <div className="flex items-center gap-3 bg-[var(--color-surface-raised)] rounded-[var(--radius-md)] px-4 py-3 shadow-[var(--shadow-card)]">
      <div
        className="w-2.5 h-2.5 rounded-full shrink-0"
        style={{ backgroundColor: color, animation: value > 0 ? "pulse-dot 2s infinite" : "none" }}
      />
      <div className="min-w-0">
        <div className="text-xl font-semibold text-[var(--color-ink)] leading-none tabular-nums">{value}</div>
        <div className="text-xs text-[var(--color-ink-muted)] mt-0.5 truncate">{label}</div>
      </div>
    </div>
  );
}
