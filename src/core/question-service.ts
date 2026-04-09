import { getDb } from "../db/connection";
import * as queries from "../db/queries";
import * as audit from "./audit-service";
import { generateUUID } from "../shared/uuid";
import { NotFoundError, ValidationError } from "../shared/errors";
import type { Question, CreateQuestionParams } from "../shared/types";

export function createQuestion(
  params: CreateQuestionParams,
  caller: string
): Question {
  if (
    (params.question_type === "single_choice" ||
      params.question_type === "multi_choice") &&
    (!params.options || params.options.length === 0)
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
    options: params.options ? JSON.stringify(params.options) : null,
    answer: null,
    status: "pending",
    created_at: now,
    answered_at: null,
  };

  const db = getDb();
  const tx = db.transaction(() => {
    queries.insertQuestion(question);
    audit.log(
      question.task_id,
      caller,
      "question_created",
      null,
      { question_id: question.id, question_text: question.question_text }
    );
  });
  tx();

  return question;
}

export function answerQuestion(
  questionId: string,
  answer: unknown,
  caller: string
): Question {
  const question = queries.getQuestionById(questionId);
  if (!question) throw new NotFoundError("Question", questionId);

  if (question.status === "answered") {
    throw new ValidationError("Question already answered");
  }

  const answerStr = JSON.stringify(answer);
  const now = new Date().toISOString();

  const db = getDb();
  const tx = db.transaction(() => {
    queries.updateQuestionAnswer(questionId, answerStr, now);
    audit.log(
      question.task_id,
      caller,
      "question_answered",
      null,
      { question_id: questionId, answer }
    );

    // If task was blocked and this was a pending question, move task back to in_progress
    if (question.task_id) {
      const task = queries.getTaskById(question.task_id);
      if (task && task.status === "blocked") {
        queries.updateTask(question.task_id, { status: "in_progress" });
        audit.log(
          question.task_id,
          "system",
          "status_changed",
          "blocked",
          "in_progress"
        );
      }
    }
  });
  tx();

  return queries.getQuestionById(questionId)!;
}

export function listQuestions(filters: {
  status?: string;
  assigned_to?: string;
  created_by?: string;
}) {
  return queries.listQuestions(filters);
}

export function getAnswer(questionId: string) {
  const question = queries.getQuestionById(questionId);
  if (!question) throw new NotFoundError("Question", questionId);
  return question;
}
