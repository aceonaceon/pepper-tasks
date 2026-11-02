import type { TaskRepository } from "../db/repository";
import type { DashboardData, DashboardLiteData } from "../shared/types";

export async function getDashboard(
  repo: TaskRepository,
  agentId?: string
): Promise<DashboardData> {
  // Auto-archive: ephemeral tasks completed >48h ago
  await repo.autoArchiveEphemeralTasks();

  const statusCounts = await repo.countTasksByStatus();

  return {
    pending_tasks: statusCounts.pending || 0,
    in_progress_tasks: statusCounts.in_progress || 0,
    blocked_tasks: statusCounts.blocked || 0,
    review_tasks: statusCounts.review || 0,
    unanswered_questions: await repo.countUnansweredQuestions(),
    newly_answered_questions: await repo.countNewlyAnsweredQuestions(),
    most_urgent: await repo.getMostUrgentTask(),
    items_waiting_for_boss: await repo.getItemsWaitingForBoss(),
    orphan_tasks: await repo.getOrphanTasks(),
    action_items: await repo.getActionItems(agentId),
  };
}

/**
 * Lightweight dashboard for heartbeat/polling.
 * Only returns recent action items (1 day) and minimal summary.
 */
export async function getDashboardLite(
  repo: TaskRepository,
  agentId?: string
): Promise<DashboardLiteData> {
  const statusCounts = await repo.countTasksByStatus();

  return {
    action_items: await repo.getActionItems(agentId, 1),
    unanswered_questions: await repo.countUnansweredQuestions(),
    summary: {
      pending: statusCounts.pending || 0,
      in_progress: statusCounts.in_progress || 0,
      blocked: statusCounts.blocked || 0,
      review: statusCounts.review || 0,
    },
  };
}
