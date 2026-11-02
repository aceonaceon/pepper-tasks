import type { AuditLog, Question, Review, Task } from "../shared/types";

export type TaskFilters = {
  status?: string;
  assigned_to?: string;
  created_by?: string;
  quadrant?: string;
  parent_task_id?: string;
  search?: string;
};

export type QuestionFilters = {
  status?: string;
  assigned_to?: string;
  created_by?: string;
  task_id?: string;
};

export type WaitingItem = {
  type: string;
  id: string;
  task_id?: string | null;
  title?: string;
  waiting_since: string;
};

export type OrphanTask = {
  task_id: string;
  title: string;
  status: string;
  assigned_to: string;
  stuck_since: string;
};

export type ActionItem = {
  priority: number;
  type: string;
  id: string;
  task_id: string | null;
  title: string;
  context: string | null;
  since: string;
};

export type UrgentTask = {
  task_id: string;
  title: string;
  deadline: string;
};

export interface TaskRepository {
  transaction<T>(callback: (repo: TaskRepository) => Promise<T>): Promise<T>;

  insertTask(task: Task): Promise<void>;
  updateTask(id: string, updates: Record<string, unknown>): Promise<void>;
  getTaskById(id: string): Promise<Task | undefined>;
  listTasks(filters: TaskFilters): Promise<Task[]>;
  getSubTasks(parentId: string): Promise<Task[]>;
  deleteTask(id: string): Promise<void>;

  insertQuestion(question: Question): Promise<void>;
  updateQuestionAnswer(id: string, answer: string, answeredAt: string): Promise<void>;
  updateQuestionStatus(id: string, status: string): Promise<void>;
  getQuestionById(id: string): Promise<Question | undefined>;
  listQuestions(filters: QuestionFilters): Promise<Question[]>;

  insertReview(review: Review): Promise<void>;
  getReviewsByTaskId(taskId: string): Promise<Review[]>;
  listReviews(filters: { task_id?: string }): Promise<Review[]>;

  insertAuditLog(log: AuditLog): Promise<void>;
  getAuditLogsByTaskId(taskId: string): Promise<AuditLog[]>;

  countTasksByStatus(): Promise<Record<string, number>>;
  countUnansweredQuestions(): Promise<number>;
  countNewlyAnsweredQuestions(): Promise<number>;
  getMostUrgentTask(): Promise<UrgentTask | null>;
  getItemsWaitingForBoss(): Promise<WaitingItem[]>;
  getOrphanTasks(): Promise<OrphanTask[]>;
  autoArchiveEphemeralTasks(): Promise<number>;
  acknowledgeAnsweredQuestions(taskId: string): Promise<number>;
  getActionItems(agentId?: string, cutoffDays?: number): Promise<ActionItem[]>;
  getFeedbackHistory(agentId?: string, limit?: number): Promise<Review[]>;
  getTasksInReview(agentId?: string): Promise<Task[]>;
}
