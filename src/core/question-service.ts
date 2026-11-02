import type { TaskRepository } from "../db/repository";
import * as audit from "./audit-service";
import { generateUUID } from "../shared/uuid";
import { ConflictError, PermissionError, NotFoundError, ValidationError } from "../shared/errors";
import type { Question, CreateQuestionParams, RetireQuestionParams } from "../shared/types";

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
    retirement_reason: null,
    retired_by: null,
    retired_at: null,
    replacement_question_id: null,
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

export async function answerQuestion(repo: TaskRepository, questionId: string, answer: unknown, caller: string): Promise<Question> {
  const question = await repo.getQuestionById(questionId);
  if (!question) throw new NotFoundError("Question", questionId);
  if (question.status !== "pending") throw new ConflictError(`Question is ${question.status} and cannot be answered`);
  const answerStr = JSON.stringify(answer);
  if (answerStr === undefined) throw new ValidationError("Answer must be JSON serializable");
  const now = new Date().toISOString();
  const changed = await repo.answerQuestionAtomic(question, answerStr, answer, caller, now);
  if (changed !== 1) {
    const current = await repo.getQuestionById(questionId);
    if (!current) throw new NotFoundError("Question", questionId);
    throw new ConflictError(`Question is ${current.status} and cannot be answered`);
  }
  return (await repo.getQuestionById(questionId))!;
}

export async function retireQuestion(repo: TaskRepository, params: RetireQuestionParams): Promise<Question> {
  const { question_id, expected_task_id, expected_description, reason, caller } = params;
  if (typeof question_id !== "string" || !question_id ||
      typeof expected_task_id !== "string" || !expected_task_id ||
      !(expected_description === null || typeof expected_description === "string") ||
      typeof caller !== "string" || !caller.trim()) {
    throw new ValidationError("Exact question, task, description, and caller are required");
  }
  if (typeof reason !== "string" || !reason.trim() || reason.length > 1000) {
    throw new ValidationError("Reason must be nonempty and at most 1000 characters");
  }
  if (params.replacement_question_id !== undefined &&
      (typeof params.replacement_question_id !== "string" || !params.replacement_question_id)) {
    throw new ValidationError("Invalid replacement question ID");
  }
  const replacementId = params.replacement_question_id ?? null;
  const question = await repo.getQuestionById(question_id);
  if (!question) throw new NotFoundError("Question", question_id);
  if (question.task_id !== expected_task_id || question.description !== expected_description) {
    throw new ConflictError("Question task or description has changed");
  }
  if (caller !== "boss" && caller !== question.created_by) {
    throw new PermissionError("Only the question creator or boss may retire it");
  }
  const checkCurrent = (current: Question) => {
    if (current.status === "obsolete") {
      if (current.retirement_reason === reason && current.retired_by === caller &&
          current.replacement_question_id === replacementId) return current;
      throw new ConflictError("Question was retired with different metadata");
    }
    if (current.status !== "pending") {
      throw new ConflictError(`Question is ${current.status} and cannot be retired`);
    }
    return null;
  };
  const replay = checkCurrent(question);
  if (replay) return replay;
  if (replacementId !== null) {
    if (replacementId === question_id) throw new ValidationError("Question cannot replace itself");
    const replacement = await repo.getQuestionById(replacementId);
    if (!replacement || replacement.status !== "pending" ||
        replacement.task_id !== question.task_id || replacement.created_by !== question.created_by ||
        replacement.assigned_to !== question.assigned_to) {
      throw new ConflictError("Replacement must be pending with the same task, creator, and assignee");
    }
  }
  const retiredAt = new Date().toISOString();
  const changed = await repo.retireQuestionAtomic(question, params, retiredAt);
  const current = await repo.getQuestionById(question_id);
  if (!current) throw new NotFoundError("Question", question_id);
  if (changed === 1) return current;
  if (current.task_id !== expected_task_id || current.description !== expected_description) {
    throw new ConflictError("Question task or description has changed");
  }
  if (caller !== "boss" && caller !== current.created_by) {
    throw new PermissionError("Only the question creator or boss may retire it");
  }
  const concurrentReplay = checkCurrent(current);
  if (concurrentReplay) return concurrentReplay;
  throw new ConflictError("Question or replacement changed before retirement");
}

export function listQuestions(repo: TaskRepository, filters: import("../db/repository").QuestionFilters) {
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
