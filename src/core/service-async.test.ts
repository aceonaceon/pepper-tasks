import { describe, expect, it } from "vitest";
import { createTask, updateTask } from "./task-service";
import { answerQuestion, createQuestion } from "./question-service";
import type { TaskRepository } from "../db/repository";
import type { AuditLog, Question, Review, Task } from "../shared/types";

class MemoryRepository implements TaskRepository {
  tasks = new Map<string, Task>();
  questions = new Map<string, Question>();
  reviews = new Map<string, Review>();
  auditLogs: AuditLog[] = [];

  async transaction<T>(callback: (repo: TaskRepository) => Promise<T>): Promise<T> {
    return callback(this);
  }

  async insertTask(task: Task): Promise<void> {
    this.tasks.set(task.id, task);
  }

  async updateTask(id: string, updates: Record<string, unknown>): Promise<void> {
    const task = this.tasks.get(id);
    if (!task) return;
    this.tasks.set(id, {
      ...task,
      ...updates,
      updated_at: new Date().toISOString(),
    } as Task);
  }

  async getTaskById(id: string): Promise<Task | undefined> {
    return this.tasks.get(id);
  }

  async listTasks(): Promise<Task[]> {
    return [...this.tasks.values()].sort((a, b) =>
      b.created_at.localeCompare(a.created_at)
    );
  }

  async getSubTasks(parentId: string): Promise<Task[]> {
    return [...this.tasks.values()].filter((task) => task.parent_task_id === parentId);
  }

  async deleteTask(id: string): Promise<void> {
    this.tasks.delete(id);
  }

  async insertQuestion(question: Question): Promise<void> {
    this.questions.set(question.id, question);
  }

  async updateQuestionAnswer(id: string, answer: string, answeredAt: string): Promise<void> {
    const question = this.questions.get(id);
    if (!question) return;
    this.questions.set(id, {
      ...question,
      answer,
      answered_at: answeredAt,
      status: "answered",
    });
  }

  async updateQuestionStatus(id: string, status: string): Promise<void> {
    const question = this.questions.get(id);
    if (!question) return;
    this.questions.set(id, { ...question, status: status as Question["status"] });
  }

  async getQuestionById(id: string): Promise<Question | undefined> {
    return this.questions.get(id);
  }

  async listQuestions(filters: { status?: string; task_id?: string }): Promise<Question[]> {
    return [...this.questions.values()].filter((question) => {
      if (filters.status && question.status !== filters.status) return false;
      if (filters.task_id && question.task_id !== filters.task_id) return false;
      return true;
    });
  }

  async insertReview(review: Review): Promise<void> {
    this.reviews.set(review.id, review);
  }

  async getReviewsByTaskId(taskId: string): Promise<Review[]> {
    return [...this.reviews.values()].filter((review) => review.task_id === taskId);
  }

  async listReviews(): Promise<Review[]> {
    return [...this.reviews.values()];
  }

  async insertAuditLog(log: AuditLog): Promise<void> {
    this.auditLogs.push(log);
  }

  async getAuditLogsByTaskId(taskId: string): Promise<AuditLog[]> {
    return this.auditLogs.filter((log) => log.task_id === taskId);
  }

  async countTasksByStatus(): Promise<Record<string, number>> {
    return {};
  }

  async countUnansweredQuestions(): Promise<number> {
    return 0;
  }

  async countNewlyAnsweredQuestions(): Promise<number> {
    return 0;
  }

  async getMostUrgentTask(): Promise<null> {
    return null;
  }

  async getItemsWaitingForBoss(): Promise<[]> {
    return [];
  }

  async getOrphanTasks(): Promise<[]> {
    return [];
  }

  async autoArchiveEphemeralTasks(): Promise<number> {
    return 0;
  }

  async acknowledgeAnsweredQuestions(taskId: string): Promise<number> {
    let changed = 0;
    for (const question of this.questions.values()) {
      if (question.task_id === taskId && question.status === "answered") {
        this.questions.set(question.id, { ...question, status: "acknowledged" });
        changed += 1;
      }
    }
    return changed;
  }

  async getActionItems(): Promise<[]> {
    return [];
  }

  async getFeedbackHistory(): Promise<Review[]> {
    return [];
  }

  async getTasksInReview(): Promise<Task[]> {
    return [...this.tasks.values()].filter((task) => task.status === "review");
  }
}

describe("async task services", () => {
  it("creates a task and audit log through an injected repository", async () => {
    const repo = new MemoryRepository();

    const task = await createTask(
      repo,
      { title: "Deploy board", assigned_to: "agent:codex" },
      "boss"
    );

    expect(await repo.getTaskById(task.id)).toMatchObject({
      title: "Deploy board",
      created_by: "boss",
      assigned_to: "agent:codex",
      status: "pending",
    });
    expect(repo.auditLogs).toHaveLength(1);
    expect(repo.auditLogs[0]).toMatchObject({
      task_id: task.id,
      actor: "boss",
      action: "created",
    });
  });

  it("answers a blocked task question and moves the task back to in progress", async () => {
    const repo = new MemoryRepository();
    const task = await createTask(
      repo,
      { title: "Need decision", assigned_to: "agent:codex" },
      "boss"
    );
    await updateTask(repo, task.id, { status: "in_progress" }, "boss");
    const question = await createQuestion(
      repo,
      {
        task_id: task.id,
        question_type: "yes_no",
        question_text: "Proceed?",
        assigned_to: "boss",
      },
      "agent:codex"
    );
    await updateTask(repo, task.id, { status: "blocked" }, "agent:codex");

    await answerQuestion(repo, question.id, true, "boss");

    await expect(repo.getTaskById(task.id)).resolves.toMatchObject({
      status: "in_progress",
    });
    await expect(repo.getQuestionById(question.id)).resolves.toMatchObject({
      status: "answered",
      answer: "true",
    });
  });
});
