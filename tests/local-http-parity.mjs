import assert from 'node:assert/strict';
import { writeFileSync } from 'node:fs';

const base = new URL(process.env.PEPPER_LOCAL_URL);
assert.equal(base.hostname, '127.0.0.1', 'Parity tests must only address local Workers');
let count = 0;
async function request(path, method = 'GET', body) {
  const response = await fetch(new URL(path, base), { method, headers: { 'content-type': 'application/json', accept: 'application/json, text/event-stream' }, ...(body === undefined ? {} : { body: typeof body === 'string' ? body : JSON.stringify(body) }) });
  const raw = await response.text();
  const data = response.headers.get('content-type')?.includes('text/event-stream') ? raw.split('\n').filter(x => x.startsWith('data:')).map(x => x.slice(5).trim()).join('\n') : raw;
  let result; try { result = data ? JSON.parse(data) : null; } catch { result = null; }
  return { status: response.status, body: result };
}
async function rpc(method, params) { return request('/mcp', 'POST', { jsonrpc: '2.0', id: ++count, method, params }); }
async function tool(name, args) {
  const r = await rpc('tools/call', { name, arguments: args });
  if (r.body?.result?.isError || r.body?.error) return { error: true };
  return JSON.parse(r.body.result.content.filter(x => x.type === 'text').map(x => x.text).join('\n'));
}
const init = await rpc('initialize', { protocolVersion: '2025-03-26', capabilities: {}, clientInfo: { name: 'local-parity', version: '1' } });
assert.equal(init.status, 200);
const tools = (await rpc('tools/list', {})).body.result.tools;
assert.ok(tools.some(t => t.name === 'question_retire'));
const owner = 'agent:local-parity';
const task = await tool('task_create', { title: '[TEST] Local retirement parity', assigned_to: owner, caller: owner });
const question = async (overrides = {}) => tool('question_create', { task_id: task.id, question_type: 'open_ended', question_text: '[TEST] Original wording?', description: 'Exact preserved context', assigned_to: 'boss', caller: owner, ...overrides });
const old = await question();
const next = await question();
const intent = { question_id: old.id, expected_task_id: task.id, expected_description: old.description, reason: 'Superseded locally', replacement_question_id: next.id, caller: owner };
assert.equal((await tool('question_retire', { ...intent, caller: 'agent:intruder' })).error, true);
assert.equal((await request(`/api/questions/${old.id}/retire`, 'POST', { ...intent, expected_description: 'wrong' })).status, 409);
const retired = await tool('question_retire', intent);
assert.equal(retired.status, 'obsolete');
assert.equal(retired.question_text, old.question_text);
assert.equal(retired.description, old.description);
assert.equal(retired.retired_by, owner);
assert.ok(retired.retired_at);
assert.equal(retired.replacement_question_id, next.id);
assert.equal((await tool('question_retire', intent)).retired_at, retired.retired_at);
assert.equal((await tool('question_retire', { ...intent, reason: 'Different' })).error, true);
const history = await tool('audit_log', { task_id: task.id });
assert.equal(history.filter(x => x.action === 'question_retired').length, 1);
assert.equal((await request(`/api/questions/${old.id}/answer`, 'PUT', { answer: 'stale' })).status, 409);
const read = (await request(`/api/questions/${old.id}`)).body;
assert.equal(read.status, 'obsolete');
assert.equal(read.answer, null);
assert.deepEqual((await tool('question_list', { question_id: old.id, status: 'pending' })), []);
assert.equal((await tool('question_list', { question_id: old.id, task_id: task.id, status: 'obsolete' })).length, 1);
for (const body of ['{bad', null, {}, []]) assert.equal((await request(`/api/questions/${next.id}/answer`, 'PUT', body)).status, 400);
for (const body of ['{bad', null, { reason: '' }, { ...intent, reason: 'x'.repeat(1001) }]) assert.equal((await request(`/api/questions/${next.id}/retire`, 'POST', body)).status, 400);
assert.equal((await request(`/api/tasks/${task.id}`, 'PUT', { status: 'in_progress' })).status, 200);
assert.equal((await request(`/api/tasks/${task.id}`, 'PUT', { status: 'blocked' })).status, 200);
assert.equal((await request(`/api/questions/${next.id}/answer`, 'PUT', { answer: { choice: 'go' } })).status, 200);
assert.equal((await request(`/api/questions/${next.id}/answer`, 'PUT', { answer: 'again' })).status, 409);
const completed = await tool('task_get', { task_id: task.id });
assert.equal(completed.task.status, 'in_progress');
assert.ok(completed.auditLogs.some(x => x.actor === 'system' && x.action === 'status_changed' && x.old_value === '"blocked"' && x.new_value === '"in_progress"'));
// Existing production data must not affect the test assertions or be included in reports.
const board = await tool('dashboard', { agent_id: owner });
assert.ok(!board.items_waiting_for_boss.some(x => x.id === old.id));
assert.ok(!board.action_items.some(x => x.task_id === task.id && x.type === 'in_progress_task'));
const routes = [];
for (const [path, method, body] of [
  ['/api/tasks', 'GET'], ['/api/tasks/missing-local-id', 'GET'],
  ['/api/tasks', 'POST', {}], ['/api/tasks/missing-local-id', 'PUT', { title: '[TEST] Missing task' }],
  ['/api/tasks/missing-local-id', 'DELETE'],
  ['/api/questions?question_id=missing-local-id', 'GET'], ['/api/questions/missing-local-id', 'GET'],
  ['/api/questions', 'POST', { task_id: task.id, question_type: 'open_ended', question_text: '[TEST] HTTP route', assigned_to: 'boss' }],
  ['/api/questions/missing-local-id/answer', 'PUT', { answer: 'local' }],
  ['/api/questions/missing-local-id/retire', 'POST', { expected_task_id: task.id, expected_description: null, reason: 'Old' }],
  ['/api/reviews', 'GET'], ['/api/reviews/missing-local-id', 'GET'],
  ['/api/reviews', 'POST', { task_id: 'missing-local-id', approved: false }], ['/api/reviews/feedback', 'GET'],
  ['/api/dashboard', 'GET'], ['/api/dashboard/lite', 'GET'], ['/api/audit/missing-local-id', 'GET'],
  ['/mcp', 'POST', {}], ['/mcp', 'GET'], ['/mcp/missing-local-id', 'GET'],
  ['/__admin/import/batch', 'POST', {}], ['/api/does-not-exist', 'GET'],
]) routes.push({ path, method, status: (await request(path, method, body)).status });
const result = { checks: 'passed', tools: tools.map(t => ({ name: t.name, description: t.description, inputSchema: t.inputSchema })).sort((a, b) => a.name.localeCompare(b.name)), routes, assertion_groups: ['MCP contract', 'retirement ownership and exact target', 'preserved wording and replacement', 'idempotent audit', 'stale answer and malformed request rejection', 'atomic blocked-task resume', 'dashboard exclusion', 'HTTP route parity'] };
writeFileSync(process.env.PEPPER_PARITY_RESULT, JSON.stringify(result, null, 2));
console.log('Local HTTP/MCP parity assertions passed; no production endpoint contacted.');
