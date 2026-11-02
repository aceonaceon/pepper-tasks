import { build } from 'tsup';
import { mkdirSync } from 'node:fs';
import { spawnSync } from 'node:child_process';
import { resolve } from 'node:path';

process.env.TMPDIR = resolve('.test-tmp');
mkdirSync(process.env.TMPDIR, { recursive: true });
await build({ entry: ['tests/question-retirement.test.ts'], config: false, format: ['cjs'], platform: 'node', target: 'node22', removeNodeProtocol: false, outDir: '.test-build', clean: true, external: ['better-sqlite3', '@modelcontextprotocol/sdk', 'hono', 'zod'] });
const result = spawnSync(process.execPath, ['--test', '--test-concurrency=1', '.test-build/question-retirement.test.js', 'tests/worker-retirement.test.mjs', 'tests/worker-version.test.mjs'], { stdio: 'inherit', env: process.env });
process.exit(result.status ?? 1);
