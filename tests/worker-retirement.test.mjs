import test from 'node:test';
import assert from 'node:assert/strict';
import { mkdtempSync, readFileSync, rmSync } from 'node:fs';
import { join } from 'node:path';
import Database from 'better-sqlite3';
const worker = (await import(process.env.PEPPER_WORKER_MODULE || '../dist/worker.mjs')).default;

const schema = `
CREATE TABLE tasks (id TEXT PRIMARY KEY, title TEXT NOT NULL, description TEXT DEFAULT '', created_by TEXT NOT NULL, assigned_to TEXT NOT NULL, status TEXT NOT NULL DEFAULT 'pending', quadrant TEXT DEFAULT 'not_urgent_not_important', task_type TEXT NOT NULL DEFAULT 'tracking', deadline TEXT, parent_task_id TEXT, created_at TEXT NOT NULL, updated_at TEXT NOT NULL);
CREATE TABLE questions (id TEXT PRIMARY KEY, task_id TEXT, created_by TEXT NOT NULL, assigned_to TEXT NOT NULL, question_type TEXT NOT NULL, question_text TEXT NOT NULL, description TEXT, options TEXT, answer TEXT, status TEXT NOT NULL CHECK(status IN ('pending','answered','acknowledged')), created_at TEXT NOT NULL, answered_at TEXT);
CREATE TABLE reviews (id TEXT PRIMARY KEY, task_id TEXT NOT NULL, reviewer TEXT NOT NULL, approved INTEGER NOT NULL, comment TEXT, created_at TEXT NOT NULL);
CREATE TABLE audit_logs (id TEXT PRIMARY KEY, task_id TEXT, actor TEXT NOT NULL, action TEXT NOT NULL, old_value TEXT, new_value TEXT, timestamp TEXT NOT NULL);
`;

function fixture() {
  const directory = mkdtempSync(join(import.meta.dirname, 'sqlite-'));
  const sqlite = new Database(join(directory, 'data.sqlite'));
  sqlite.exec(schema);
  sqlite.exec(readFileSync(new URL('../migrations/0002_question_retirements.sql', import.meta.url), 'utf8'));
  const hook = { beforeBatch: null };
  const db = {
    prepare(sql) {
      return {
        bind(...params) {
          return { sql, params, run: () => run(sql, params), first: () => sqlite.prepare(sql).get(...params), all: () => ({ results: sqlite.prepare(sql).all(...params) }) };
        }
      };
    },
    async batch(statements) {
      if (hook.beforeBatch) { const callback = hook.beforeBatch; hook.beforeBatch = null; callback(sqlite); }
      return sqlite.transaction(() => statements.map(statement => run(statement.sql, statement.params)))();
    }
  };
  function run(sql, params) { const info = sqlite.prepare(sql).run(...params); return { meta: { changes: info.changes } }; }
  const timestamp = '2026-10-19T00:00:00.000Z';
  sqlite.prepare('INSERT INTO tasks (id,title,created_by,assigned_to,status,created_at,updated_at) VALUES (?,?,?,?,?,?,?)').run('task-1','Draft','agent','agent','blocked',timestamp,timestamp);
  function question(id, overrides = {}) {
    const q = { id, task_id: 'task-1', created_by: 'agent', assigned_to: 'boss', question_type: 'open_ended', question_text: `Question ${id}?`, description: 'Exact context', options: null, answer: null, status: 'pending', created_at: timestamp, answered_at: null, ...overrides };
    sqlite.prepare('INSERT INTO questions VALUES (@id,@task_id,@created_by,@assigned_to,@question_type,@question_text,@description,@options,@answer,@status,@created_at,@answered_at)').run(q);
    return q;
  }
  question('q1');
  const request = async (path, method = 'GET', body) => {
    const response = await worker.fetch(new Request(`https://local.test${path}`, { method, headers: { 'content-type': 'application/json', accept: 'application/json, text/event-stream' }, ...(body === undefined ? {} : { body: typeof body === 'string' ? body : JSON.stringify(body) }) }), { DB: db }, {});
    const raw = await response.text();
    const payload = response.headers.get('content-type')?.includes('text/event-stream') ? raw.match(/^data: (.+)$/m)?.[1] : raw;
    let parsed; try { parsed = payload ? JSON.parse(payload) : null; } catch { parsed = raw; }
    return { status: response.status, body: parsed, raw };
  };
  const retire = (data = {}) => request('/api/questions/q1/retire', 'POST', { expected_task_id: 'task-1', expected_description: 'Exact context', reason: 'Superseded', ...data });
  let callId = 1;
  const mcp = (method, params) => request('/mcp', 'POST', { jsonrpc: '2.0', id: callId++, method, params });
  return { sqlite, hook, question, request, retire, mcp, close: () => { sqlite.close(); rmSync(directory, { recursive: true, force: true }); } };
}

test('REST retirement derives obsolete, preserves question, and records one audit on exact replay', async () => {
  const f = fixture();
  try {
    const retired = await f.retire();
    assert.equal(retired.status, 200);
    assert.equal(retired.body.status, 'obsolete');
    assert.equal(retired.body.question_text, 'Question q1?');
    assert.equal(retired.body.retired_by, 'boss');
    assert.equal(f.sqlite.prepare('SELECT status FROM questions WHERE id = ?').get('q1').status, 'pending');
    assert.equal((await f.retire()).body.retired_at, retired.body.retired_at);
    assert.equal(f.sqlite.prepare("SELECT count(*) n FROM audit_logs WHERE action='question_retired'").get().n, 1);
  } finally { f.close(); }
});

test('retired questions leave every pending surface and cannot be answered', async () => {
  const f = fixture();
  try {
    assert.equal((await f.retire()).status, 200);
    const pending = await f.request('/api/questions?task_id=task-1&status=pending');
    assert.deepEqual(pending.body, []);
    const obsolete = await f.request('/api/questions?question_id=q1&status=obsolete');
    assert.equal(obsolete.body.length, 1);
    assert.equal((await f.request('/api/questions/q1')).body.status, 'obsolete');
    const answer = await f.request('/api/questions/q1/answer', 'PUT', { answer: 'stale' });
    assert.equal(answer.status, 409);
    const dashboard = (await f.request('/api/dashboard')).body;
    assert.equal(dashboard.unanswered_questions, 0);
    assert.equal(dashboard.items_waiting_for_boss.some(item => item.id === 'q1'), false);
    assert.equal(dashboard.orphan_tasks.some(item => item.task_id === 'task-1'), true);
    assert.equal(dashboard.action_items.some(item => item.type === 'orphan_task' && item.task_id === 'task-1'), true);
    assert.equal(f.sqlite.prepare("SELECT status FROM tasks WHERE id='task-1'").get().status, 'blocked');
    assert.equal(f.sqlite.prepare("SELECT count(*) n FROM audit_logs WHERE action='question_answered'").get().n, 0);
    assert.equal((await f.request('/api/tasks/task-1')).body.questions[0].status, 'obsolete');
    assert.equal((await f.request('/api/dashboard/lite')).body.unanswered_questions, 0);
    f.sqlite.prepare("UPDATE tasks SET status='in_progress' WHERE id='task-1'").run();
    const blocked = await f.request('/api/tasks/task-1', 'PUT', { status: 'blocked' });
    assert.equal(blocked.status, 400);
    assert.equal(f.sqlite.prepare("SELECT status FROM tasks WHERE id='task-1'").get().status, 'in_progress');
  } finally { f.close(); }
});

test('retirement validates exact target, owner, reason, replacement, and replay intent', async () => {
  const f = fixture();
  try {
    f.question('replacement');
    f.question('foreign-task', { task_id: 'task-2' });
    f.question('foreign-owner', { created_by: 'other' });
    f.question('foreign-assignee', { assigned_to: 'other' });
    f.sqlite.prepare('INSERT INTO tasks (id,title,created_by,assigned_to,status,created_at,updated_at) VALUES (?,?,?,?,?,?,?)').run('task-2','Other','agent','agent','pending','2026-10-19','2026-10-19');
    for (const data of [
      { expected_task_id: 'wrong' }, { expected_description: 'short' }, { reason: '' },
      { reason: 'x'.repeat(1001) }, { replacement_question_id: 'q1' },
      { replacement_question_id: 'foreign-task' }, { replacement_question_id: 'foreign-owner' },
      { replacement_question_id: 'foreign-assignee' }, { replacement_question_id: 'missing' },
    ]) assert.ok((await f.retire(data)).status >= 400);
    assert.equal((await f.request('/api/questions/q1/retire', 'POST', '{bad')).status, 400);
    assert.equal((await f.request('/api/questions/q1/retire', 'POST', null)).status, 400);
    assert.equal((await f.request('/api/questions/q1/retire', 'POST', { reason: 'missing CAS' })).status, 400);
    assert.equal((await f.request('/api/questions/missing/retire', 'POST', { expected_task_id: 'task-1', expected_description: null, reason: 'Old' })).status, 404);
    const first = await f.retire({ replacement_question_id: 'replacement' });
    assert.equal(first.status, 200);
    assert.equal(first.body.replacement_question_id, 'replacement');
    assert.equal((await f.retire({ replacement_question_id: 'replacement' })).status, 200);
    assert.equal((await f.retire({ reason: 'Different', replacement_question_id: 'replacement' })).status, 409);
    assert.equal((await f.retire()).status, 409);
    assert.equal(f.sqlite.prepare("SELECT count(*) n FROM audit_logs WHERE action='question_retired'").get().n, 1);
  } finally { f.close(); }
});

test('answered rows stay answered with their content and are never retired', async () => {
  const f = fixture();
  try {
    const answer = await f.request('/api/questions/q1/answer', 'PUT', { answer: 'Original answer' });
    assert.equal(answer.status, 200);
    assert.equal((await f.retire()).status, 409);
    const saved = f.sqlite.prepare("SELECT question_text,answer,status,answered_at FROM questions WHERE id='q1'").get();
    assert.equal(saved.answer, JSON.stringify('Original answer'));
    assert.equal(saved.question_text, 'Question q1?');
    assert.ok(saved.answered_at);
    assert.equal(f.sqlite.prepare('SELECT count(*) n FROM question_retirements').get().n, 0);
    assert.equal(f.sqlite.prepare("SELECT status FROM tasks WHERE id='task-1'").get().status, 'in_progress');
    assert.equal((await f.request('/api/questions/q1')).body.status, 'acknowledged');
    assert.equal((await f.retire()).status, 409);
  } finally { f.close(); }
});

test('MCP initialize, list, retire, and filtered readback use real HTTP transport', async () => {
  const f = fixture();
  try {
    const init = await f.mcp('initialize', { protocolVersion: '2025-03-26', capabilities: {}, clientInfo: { name: 'synthetic', version: '1' } });
    assert.equal(init.status, 200);
    assert.ok(init.body.result);
    const tools = await f.mcp('tools/list', {});
    assert.ok(tools.body.result.tools.some(tool => tool.name === 'question_retire'));
    const unauthorized = await f.mcp('tools/call', { name: 'question_retire', arguments: { question_id: 'q1', expected_task_id: 'task-1', expected_description: 'Exact context', reason: 'Old', caller: 'intruder' } });
    assert.equal(unauthorized.body.result.isError, true);
    const unexpected = await f.mcp('tools/call', { name: 'question_retire', arguments: { question_id: 'q1', expected_task_id: 'task-1', expected_description: 'Exact context', reason: 'Old', caller: 'agent', extra: true } });
    assert.ok(unexpected.body.error || unexpected.body.result?.isError);
    const retire = await f.mcp('tools/call', { name: 'question_retire', arguments: { question_id: 'q1', expected_task_id: 'task-1', expected_description: 'Exact context', reason: 'Old', caller: 'agent' } });
    assert.equal(JSON.parse(retire.body.result.content[0].text).status, 'obsolete');
    const list = await f.mcp('tools/call', { name: 'question_list', arguments: { question_id: 'q1', task_id: 'task-1', status: 'obsolete' } });
    assert.equal(JSON.parse(list.body.result.content[0].text).length, 1);
    const replay = await f.mcp('tools/call', { name: 'question_retire', arguments: { question_id: 'q1', expected_task_id: 'task-1', expected_description: 'Exact context', reason: 'Old', caller: 'agent' } });
    assert.equal(replay.body.result.isError, undefined);
    assert.equal(f.sqlite.prepare("SELECT count(*) n FROM audit_logs WHERE action='question_retired'").get().n, 1);
  } finally { f.close(); }
});

test('races between read and D1 batch fail CAS without audit or task status changes', async () => {
  for (const race of ['answer-first', 'description-change', 'replacement-retired', 'retire-first', 'answer-task-changed']) {
    const f = fixture();
    try {
      if (race === 'replacement-retired') f.question('replacement');
      f.hook.beforeBatch = sqlite => {
        if (race === 'answer-first') sqlite.prepare("UPDATE questions SET status='answered', answer='\"winner\"' WHERE id='q1'").run();
        if (race === 'description-change') sqlite.prepare("UPDATE questions SET description='changed' WHERE id='q1'").run();
        if (race === 'replacement-retired') sqlite.prepare("INSERT INTO question_retirements VALUES ('replacement','Old','agent','2026-10-19',NULL)").run();
        if (race === 'retire-first') sqlite.prepare("INSERT INTO question_retirements VALUES ('q1','Race','agent','2026-10-19',NULL)").run();
        if (race === 'answer-task-changed') sqlite.prepare("UPDATE questions SET task_id='task-2' WHERE id='q1'").run();
      };
      const result = race === 'retire-first' || race === 'answer-task-changed' ? await f.request('/api/questions/q1/answer', 'PUT', { answer: 'late' }) : await f.retire(race === 'replacement-retired' ? { replacement_question_id: 'replacement' } : {});
      assert.equal(result.status, 409, race);
      assert.equal(f.sqlite.prepare('SELECT count(*) n FROM audit_logs').get().n, 0, race);
      assert.equal(f.sqlite.prepare("SELECT status FROM tasks WHERE id='task-1'").get().status, 'blocked', race);
      if (race === 'retire-first' || race === 'answer-task-changed') assert.equal(f.sqlite.prepare("SELECT answer FROM questions WHERE id='q1'").get().answer, null);
    } finally { f.close(); }
  }
});

test('migration is additive, idempotent, and keeps legacy pending questions pending', async () => {
  const f = fixture();
  try {
    f.sqlite.exec(readFileSync(new URL('../migrations/0002_question_retirements.sql', import.meta.url), 'utf8'));
    assert.equal((await f.request('/api/questions/q1')).body.status, 'pending');
    assert.equal(f.sqlite.prepare('SELECT count(*) n FROM question_retirements').get().n, 0);
    assert.match(f.sqlite.prepare("SELECT sql FROM sqlite_master WHERE name='questions'").get().sql, /CHECK\(status IN \('pending','answered','acknowledged'\)\)/);
  } finally { f.close(); }
});

test('newly created questions expose null retirement fields', async () => {
  const f = fixture();
  try {
    const created = await f.request('/api/questions', 'POST', { task_id: 'task-1', question_type: 'open_ended', question_text: 'New question?', assigned_to: 'boss' });
    assert.equal(created.status, 201);
    assert.equal(created.body.status, 'pending');
    for (const field of ['retirement_reason', 'retired_by', 'retired_at', 'replacement_question_id']) assert.equal(created.body[field], null);
  } finally { f.close(); }
});

test('answer endpoint rejects malformed or missing answer without writes', async () => {
  const f = fixture();
  try {
    for (const body of ['{bad', null, {}, []]) {
      const response = await f.request('/api/questions/q1/answer', 'PUT', body);
      assert.equal(response.status, 400);
    }
    assert.equal(f.sqlite.prepare("SELECT status FROM questions WHERE id='q1'").get().status, 'pending');
    assert.equal(f.sqlite.prepare('SELECT count(*) n FROM audit_logs').get().n, 0);
  } finally { f.close(); }
});
