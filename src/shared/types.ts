export type TaskStatus =
  | "pending"
  | "in_progress"
  | "blocked"
  | "review"
  | "completed"
  | "archived";

export type Quadrant =
  | "urgent_important"
  | "not_urgent_important"
  | "urgent_not_important"
  | "not_urgent_not_important";

export type QuestionType =
  | "yes_no"
  | "single_choice"
  | "multi_choice"
  | "datetime"
  | "open_ended";

export type QuestionStatus = "pending" | "answered" | "acknowledged";

export interface Task {
  id: string;
  title: string;
  description: string;
  created_by: string;
  assigned_to: string;
  status: TaskStatus;
  quadrant: Quadrant;
  deadline: string | null;
  parent_task_id: string | null;
  created_at: string;
  updated_at: string;
}

export interface Question {
  id: string;
  task_id: string | null;
  created_by: string;
  assigned_to: string;
  question_type: QuestionType;
  question_text: string;
  description: string | null;
  options: string | null;
  answer: string | null;
  status: QuestionStatus;
  created_at: string;
  answered_at: string | null;
}

export interface Review {
  id: string;
  task_id: string;
  reviewer: string;
  approved: number;
  comment: string;
  created_at: string;
}

export interface AuditLog {
  id: string;
  task_id: string | null;
  actor: string;
  action: string;
  old_value: string | null;
  new_value: string | null;
  timestamp: string;
}

export interface CreateTaskParams {
  title: string;
  description?: string;
  assigned_to: string;
  quadrant?: Quadrant;
  deadline?: string;
  parent_task_id?: string;
}

export interface UpdateTaskParams {
  status?: TaskStatus;
  title?: string;
  description?: string;
  quadrant?: Quadrant;
  deadline?: string | null;
  assigned_to?: string;
}

export interface CreateQuestionParams {
  task_id?: string;
  question_type: QuestionType;
  description?: string;
  question_text: string;
  options?: string[];
  assigned_to: string;
}

export interface DashboardData {
  pending_tasks: number;
  in_progress_tasks: number;
  blocked_tasks: number;
  review_tasks: number;
  unanswered_questions: number;
  newly_answered_questions: number;
  most_urgent: {
    task_id: string;
    title: string;
    deadline: string;
  } | null;
  items_waiting_for_boss: Array<{
    type: "question" | "review";
    id: string;
    task_id?: string;
    title?: string;
    waiting_since: string;
  }>;
  orphan_tasks: Array<{
    task_id: string;
    title: string;
    status: string;
    assigned_to: string;
    stuck_since: string;
  }>;
  action_items: Array<{
    priority: number;
    type: string;
    id: string;
    task_id: string | null;
    title: string;
    context: string | null;
    since: string;
  }>;
}

export const VALID_TRANSITIONS: Record<TaskStatus, TaskStatus[]> = {
  pending: ["in_progress"],
  in_progress: ["blocked", "review"],
  blocked: ["in_progress"],
  review: ["completed", "in_progress"],
  completed: ["archived"],
  archived: [],
};
