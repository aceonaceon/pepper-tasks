import * as queries from "../db/queries";
import type { DashboardData } from "../shared/types";

export function getDashboard(agentId?: string): DashboardData {
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
  };
}
