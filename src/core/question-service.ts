import type { TaskRepository } from "../db/repository";
import * as audit from "./audit-service";
import { generateUUID } from "../shared/uuid";
import { NotFoundError, ValidationError } from "../shared/errors";
import type { Question, CreateQuestionParams } from "../shared/types";

export async function createQuestion(
  repo: TaskRepository,
  params: CreateQuestionParams,
  caller: string
): Promise<Question> {
  const options = normalizeOptions((params as { options?: unknown }).options);

  if (
    (params.question_type === "single_choice" ||
      params.question_type === "multi_choice") &&
    (!options || options.length === 0)
  ) {
    throw new ValidationError(
      "Choice-type questions must have at least one option"
    );
  }

  const now = new Date().toISOString();
  const question: Question = {
    id: generateUUID(),
    task_id: params.task_id || null,
    created_by: caller,
    assigned_to: params.assigned_to,
    question_type: params.question_type,
    question_text: params.question_text,
    description: params.description || null,
    options: options ? JSON.stringify(options) : null,
    answer: null,
    status: "pending",
    created_at: now,
    answered_at: null,
  };

  await repo.transaction(async (tx) => {
    await tx.insertQuestion(question);
    await audit.log(
      tx,
      question.task_id,
      caller,
      "question_created",
      null,
      { question_id: question.id, question_text: question.question_text }
    );
  });

  return question;
}

function normalizeOptions(options: unknown): string[] | undefined {
  if (options == null) return undefined;

  if (Array.isArray(options)) {
    const normalized = options.map((option) => {
      if (typeof option !== "string") {
        throw new ValidationError("Question options must be strings");
      }
      return option.trim();
    });
    return normalized.filter(Boolean);
  }

  if (typeof options === "string") {
    try {
      const parsed = JSON.parse(options);
      if (Array.isArray(parsed)) return normalizeOptions(parsed);
    } catch {}
  }

  throw new ValidationError("Question options must be an array of strings");
}

export async function answerQuestion(
  repo: TaskRepository,
  questionId: string,
  answer: unknown,
  caller: string
): Promise<Question> {
  const question = await repo.getQuestionById(questionId);
  if (!question) throw new NotFoundError("Question", questionId);

  if (question.status === "answered") {
    throw new ValidationError("Question already answered");
  }

  const answerStr = JSON.stringify(answer);
  const now = new Date().toISOString();
  const task = question.task_id ? await repo.getTaskById(question.task_id) : null;

  await repo.transaction(async (tx) => {
    await tx.updateQuestionAnswer(questionId, answerStr, now);
    await audit.log(
      tx,
      question.task_id,
      caller,
      "question_answered",
      null,
      { question_id: questionId, answer }
    );

    // If task was blocked and this was a pending question, move task back to in_progress
    if (question.task_id && task?.status === "blocked") {
        await tx.updateTask(question.task_id, { status: "in_progress" });
        await audit.log(
          tx,
          question.task_id,
          "system",
          "status_changed",
          "blocked",
          "in_progress"
        );
    }
  });

  return (await repo.getQuestionById(questionId))!;
}

export function listQuestions(repo: TaskRepository, filters: {
  status?: string;
  assigned_to?: string;
  created_by?: string;
}) {
  return repo.listQuestions(filters);
}

export async function getAnswer(repo: TaskRepository, questionId: string) {
  const question = await repo.getQuestionById(questionId);
  if (!question) throw new NotFoundError("Question", questionId);

  // Auto-acknowledge: Agent 讀過答案就標記已讀，從 action_items 移除
  // 同 task 的所有 answered questions 一起 acknowledge（避免逐個讀）
  if (question.status === "answered") {
    if (question.task_id) {
      await repo.acknowledgeAnsweredQuestions(question.task_id);
    } else {
      await repo.updateQuestionStatus(questionId, "acknowledged");
    }
  }

  const updatedQuestion = (await repo.getQuestionById(questionId))!;

  // Attach task context so Agent has full picture in one API call
  let task: { id: string; title: string; description: string; status: string } | null = null;
  if (updatedQuestion.task_id) {
    const t = await repo.getTaskById(updatedQuestion.task_id);
    if (t) {
      task = { id: t.id, title: t.title, description: t.description, status: t.status };
    }
  }

  return { ...updatedQuestion, task };
}
