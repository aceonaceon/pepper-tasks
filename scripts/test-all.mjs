import { spawnSync } from 'node:child_process';
function run(args) { const r = spawnSync(process.execPath, args, { stdio: 'inherit', env: process.env }); if (r.status !== 0) process.exit(r.status ?? 1); }
run(['node_modules/vitest/vitest.mjs', 'run']);
run(['node_modules/tsup/dist/cli-default.js', '--env.NODE_ENV', 'production']);
run(['scripts/test-retirement.mjs']);
