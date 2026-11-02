import test from 'node:test';
import assert from 'node:assert/strict';
import { execFileSync } from 'node:child_process';
import worker from '../dist/worker.mjs';

test('HTTP version and MCP initialization identify the same git build', async () => {
  const versionResponse = await worker.fetch(new Request('https://local.test/api/version'), { DB: {} }, {});
  assert.equal(versionResponse.status, 200);
  const version = await versionResponse.json();
  assert.match(version.commit, /^[a-f0-9]{40}$/);
  assert.equal(typeof version.dirty, 'boolean');
  const git = (args) => execFileSync('git', args, { encoding: 'utf8', env: { ...process.env, GIT_OPTIONAL_LOCKS: '0' } }).trim();
  assert.equal(version.commit, git(['rev-parse', 'HEAD']));
  assert.equal(version.dirty, git(['status', '--porcelain']).length > 0);
  const r = await worker.fetch(new Request('https://local.test/mcp', { method: 'POST', headers: {'content-type':'application/json', accept:'application/json, text/event-stream'}, body:JSON.stringify({jsonrpc:'2.0',id:'version-test',method:'initialize',params:{protocolVersion:'2025-03-26',capabilities:{},clientInfo:{name:'version-test',version:'1'}}}) }), {DB:{}}, {});
  const text = await r.text();
  const data = r.headers.get('content-type').includes('text/event-stream') ? JSON.parse(text.match(/^data: (.+)$/m)[1]) : JSON.parse(text);
  assert.equal(data.result.serverInfo.version, version.commit + (version.dirty ? '-dirty' : ''));
});
