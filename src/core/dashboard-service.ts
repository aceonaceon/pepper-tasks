import * as queries from "../db/queries";
import type { DashboardData, DashboardLiteData } from "../shared/types";

export function getDashboard(agentId?: string): DashboardData {
  // Auto-archive: ephemeral tasks completed >48h ago
  queries.autoArchiveEphemeralTasks();

  const statusCounts = queries.countTasksByStatus();

  return {
    pending_tasks: statusCounts.pending || 0,
    in_progress_tasks: statusCounts.in_progress || 0,
    blocked_tasks: statusCounts.blocked || 0,
    review_tasks: statusCounts.review || 0,
    unanswered_questions: queries.countUnansweredQuestions(),
    newly_answered_questions: queries.countNewlyAnsweredQuestions(),
    most_urgent: queries.getMostUrgentTask(),
    items_waiting_for_boss: queries.getItemsWaitingForBoss(),
    orphan_tasks: queries.getOrphanTasks(),
    action_items: queries.getActionItems(agentId),
  };
}

/**
 * Lightweight dashboard for heartbeat/polling.
 * Only returns recent action items (1 day) and minimal summary.
 */
export function getDashboardLite(agentId?: string): DashboardLiteData {
  const statusCounts = queries.countTasksByStatus();

  return {
    action_items: queries.getActionItems(agentId, 1),
    unanswered_questions: queries.countUnansweredQuestions(),
    summary: {
      pending: statusCounts.pending || 0,
      in_progress: statusCounts.in_progress || 0,
      blocked: statusCounts.blocked || 0,
      review: statusCounts.review || 0,
    },
  };
}
