import test, { afterEach, beforeEach } from "node:test";
import assert from "node:assert/strict";
import { mkdtempSync, rmSync } from "node:fs";
import { join } from "node:path";
import Database from "better-sqlite3";
import { closeDb, getDb } from "../src/db/connection";
import * as tasks from "../src/core/task-service";
import * as questions from "../src/core/question-service";
import * as dashboard from "../src/core/dashboard-service";
import { createApp } from "../src/http/create-app";
import { createMcpServer } from "../src/mcp/server";
import { Client } from "@modelcontextprotocol/sdk/client/index.js";
import { InMemoryTransport } from "@modelcontextprotocol/sdk/inMemory.js";

import { SqliteTaskRepository } from "../src/db/sqlite-repository";
const repo = () => new SqliteTaskRepository(getDb());
let directory: string;
beforeEach(() => {
  directory = mkdtempSync(join(process.env.TMPDIR!, "pepper-retire-"));
  process.env.ATB_DB_PATH = join(directory, "data.db");
});
afterEach(() => {
  closeDb();
  rmSync(directory, { recursive: true, force: true });
});

async function fixture(description: string | undefined = "exact draft context") {
  const task = (await tasks.createTask(repo(), { title: "Review draft", assigned_to: "agent" }, "agent"));
  const old = (await questions.createQuestion(repo(), { task_id: task.id, question_type: "open_ended", question_text: "Review?", description, assigned_to: "boss" }, "agent"));
  return { task, old };
}

test("retirement preserves content, excludes pending surfaces, and rejects a stale answer", async () => {
  const { task, old } = await fixture();
  const replacement = (await questions.createQuestion(repo(), { task_id: task.id, question_type: "open_ended", question_text: "New review?", assigned_to: "boss" }, "agent"));
  const request = { question_id: old.id, expected_task_id: task.id, expected_description: old.description, reason: "Draft replaced", caller: "agent", replacement_question_id: replacement.id };
  const retired = (await questions.retireQuestion(repo(), request));
  assert.equal(retired.status, "obsolete");
  assert.equal(retired.retirement_reason, "Draft replaced");
  assert.equal(retired.retired_by, "agent");
  assert.ok(retired.retired_at);
  assert.equal(retired.replacement_question_id, replacement.id);
  assert.equal(retired.question_text, old.question_text);
  assert.equal(retired.description, old.description);
  assert.equal(retired.answer, null);
  assert.equal(retired.answered_at, null);
  assert.equal((await questions.listQuestions(repo(), { status: "pending", task_id: task.id })).length, 1);
  assert.equal((await questions.listQuestions(repo(), { status: "obsolete", question_id: old.id })).length, 1);
  assert.equal((await tasks.getTask(repo(), task.id)).questions.length, 2);
  assert.equal((await tasks.getTask(repo(), task.id)).task.status, "pending");
  assert.equal((await dashboard.getDashboard(repo())).unanswered_questions, 1);
  assert.equal((await dashboard.getDashboard(repo())).items_waiting_for_boss.some(item => item.id === old.id), false);
  await assert.rejects(async () => (await questions.answerQuestion(repo(), old.id, "stale answer", "boss")));
  assert.equal((await questions.getAnswer(repo(), old.id)).answer, null);
  assert.equal(getDb().prepare("SELECT COUNT(*) AS n FROM audit_logs WHERE action = 'question_retired'").get().n, 1);
  assert.deepEqual((await questions.retireQuestion(repo(), request)), retired);
  closeDb();
  assert.deepEqual((await questions.retireQuestion(repo(), request)), retired);
  assert.equal(getDb().prepare("SELECT COUNT(*) AS n FROM audit_logs WHERE action = 'question_retired'").get().n, 1);
});

test("retirement validates exact target, owner, replacement, and conflicting retries", async () => {
  const { task, old } = await fixture();
  const otherTask = (await tasks.createTask(repo(), { title: "Other", assigned_to: "agent" }, "agent"));
  const crossTask = (await questions.createQuestion(repo(), { task_id: otherTask.id, question_type: "open_ended", question_text: "Other?", assigned_to: "boss" }, "agent"));
  const crossOwner = (await questions.createQuestion(repo(), { task_id: task.id, question_type: "open_ended", question_text: "Other owner?", assigned_to: "boss" }, "another"));
  const crossAssignee = (await questions.createQuestion(repo(), { task_id: task.id, question_type: "open_ended", question_text: "Other assignee?", assigned_to: "someone" }, "agent"));
  const base = { question_id: old.id, expected_task_id: task.id, expected_description: old.description, reason: "Old context", caller: "agent" };
  for (const request of [
    { ...base, expected_task_id: otherTask.id },
    { ...base, expected_description: "abbreviated" },
    { ...base, caller: "intruder" },
    { ...base, reason: "" },
    { ...base, reason: "x".repeat(1001) },
    { ...base, replacement_question_id: old.id },
    { ...base, replacement_question_id: crossTask.id },
    { ...base, replacement_question_id: crossOwner.id },
    { ...base, replacement_question_id: crossAssignee.id },
    { ...base, replacement_question_id: "missing" },
  ]) await assert.rejects(async () => (await questions.retireQuestion(repo(), request)));
  assert.equal((await questions.getAnswer(repo(), old.id)).status, "pending");
  (await questions.retireQuestion(repo(), base));
  for (const request of [
    { ...base, reason: "Different" },
    { ...base, caller: "boss" },
    { ...base, replacement_question_id: crossTask.id },
  ]) await assert.rejects(async () => (await questions.retireQuestion(repo(), request)));
});

test("answered and acknowledged questions cannot be retired", async () => {
  const { task, old } = await fixture();
  (await questions.answerQuestion(repo(), old.id, "keep this answer", "boss"));
  const request = { question_id: old.id, expected_task_id: task.id, expected_description: old.description, reason: "Old", caller: "agent" };
  await assert.rejects(async () => (await questions.retireQuestion(repo(), request)));
  (await questions.getAnswer(repo(), old.id));
  await assert.rejects(async () => (await questions.retireQuestion(repo(), request)));
  const saved = (await questions.getAnswer(repo(), old.id));
  assert.equal(saved.status, "acknowledged");
  assert.equal(saved.answer, JSON.stringify("keep this answer"));
  assert.ok(saved.answered_at);
});

test("schema initialization is idempotent and preserves existing question data", async () => {
  const { old } = await fixture("");
  const { initializeSchema } = require("../src/db/schema");
  initializeSchema(getDb());
  initializeSchema(getDb());
  assert.equal((await questions.getAnswer(repo(), old.id)).description, null);
  assert.equal((await questions.listQuestions(repo(), { question_id: old.id })).length, 1);
});

test("legacy questions survive the additive migration", async () => {
  const legacy = new Database(process.env.ATB_DB_PATH!);
  legacy.exec(`CREATE TABLE questions (
    id TEXT PRIMARY KEY, task_id TEXT, created_by TEXT NOT NULL, assigned_to TEXT NOT NULL,
    question_type TEXT NOT NULL, question_text TEXT NOT NULL, options TEXT, answer TEXT,
    status TEXT NOT NULL CHECK(status IN ('pending','answered')),
    created_at TEXT NOT NULL, answered_at TEXT
  );
  INSERT INTO questions VALUES
    ('legacy-question', NULL, 'agent', 'boss', 'open_ended', 'Original wording', NULL,
     NULL, 'pending', '2025-01-01T00:00:00Z', NULL);`);
  legacy.close();
  const original = (await questions.getAnswer(repo(), "legacy-question"));
  assert.equal(original.question_text, "Original wording");
  assert.equal(original.status, "pending");
  assert.equal(original.description, null);
  assert.equal(original.retirement_reason, null);
  assert.equal(getDb().prepare("SELECT COUNT(*) AS n FROM question_retirements").get().n, 0);
});

test("REST retirement uses boss identity and stale answer returns 409", async () => {
  const { task, old } = await fixture();
  const app = createApp({ getRepository: () => repo() });
  const retire = await app.request(`/api/questions/${old.id}/retire`, {
    method: "POST",
    headers: { "content-type": "application/json" },
    body: JSON.stringify({ expected_task_id: task.id, expected_description: old.description,
      reason: "Outdated", caller: "intruder" }),
  });
  assert.equal(retire.status, 200);
  const result = await retire.json();
  assert.equal(result.retired_by, "boss");
  assert.equal(result.status, "obsolete");
  const answer = await app.request(`/api/questions/${old.id}/answer`, {
    method: "PUT", headers: { "content-type": "application/json" },
    body: JSON.stringify({ answer: "stale" }),
  });
  assert.equal(answer.status, 409);
  const readback = await app.request(`/api/questions?question_id=${old.id}&status=obsolete`);
  assert.equal((await readback.json()).length, 1);
  const wrong = await app.request(`/api/questions/${old.id}/retire`, {
    method: "POST", headers: { "content-type": "application/json" },
    body: JSON.stringify({ expected_task_id: "wrong", expected_description: old.description, reason: "Outdated" }),
  });
  assert.equal(wrong.status, 409);
});

test("REST retirement rejects malformed and incomplete requests as 4xx", async () => {
  const { old } = await fixture();
  const app = createApp({ getRepository: () => repo() });
  for (const body of ["{bad json", "null", JSON.stringify({ reason: "missing exact target" })]) {
    const response = await app.request(`/api/questions/${old.id}/retire`, {
      method: "POST", headers: { "content-type": "application/json" }, body,
    });
    assert.ok(response.status >= 400 && response.status < 500);
  }
  assert.equal((await questions.getAnswer(repo(), old.id)).status, "pending");
});

test("MCP transport exposes retirement and exact filtered readback", async () => {
  const { task, old } = await fixture();
  const server = createMcpServer(repo());
  const client = new Client({ name: "retirement-test", version: "1.0.0" });
  const [clientTransport, serverTransport] = InMemoryTransport.createLinkedPair();
  try {
    await server.connect(serverTransport);
    await client.connect(clientTransport);
    const tools = await client.listTools();
    assert.ok(tools.tools.some(tool => tool.name === "question_retire"));
    const retired = await client.callTool({ name: "question_retire", arguments: {
      question_id: old.id, expected_task_id: task.id,
      expected_description: old.description, reason: "Superseded", caller: "agent",
    } });
    assert.equal(retired.isError, undefined);
    assert.equal(JSON.parse(retired.content[0].text).status, "obsolete");
    const readback = await client.callTool({ name: "question_list", arguments: {
      question_id: old.id, task_id: task.id, status: "obsolete",
    } });
    assert.equal(JSON.parse(readback.content[0].text).length, 1);
  } finally {
    await client.close();
    await server.close();
  }
});
