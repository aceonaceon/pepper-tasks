import { execFileSync } from "node:child_process";
import { defineConfig } from "tsup";

let commit = "unknown";
let dirty = false;
try {
  commit = execFileSync("git", ["rev-parse", "HEAD"], { encoding: "utf8" }).trim();
  dirty = execFileSync("git", ["status", "--porcelain"], { encoding: "utf8", env: { ...process.env, GIT_OPTIONAL_LOCKS: "0" } }).trim().length > 0;
} catch { /* An installed source archive may have no Git metadata. */ }
const versionDefine = {
  "process.env.PEPPER_BUILD_COMMIT": JSON.stringify(commit),
  "process.env.PEPPER_BUILD_DIRTY": JSON.stringify(String(dirty)),
};

export default defineConfig([
  {
    entry: { cli: "bin/cli.ts" },
    format: ["cjs"],
    target: "node18",
    outDir: "dist",
    clean: false,
    define: versionDefine,
    external: ["better-sqlite3"],
    banner: { js: "#!/usr/bin/env node" },
    sourcemap: false,
    splitting: false,
  },
  {
    entry: { worker: "src/worker.ts" },
    format: ["esm"],
    target: "es2022",
    platform: "browser",
    outDir: "dist",
    clean: false,
    define: versionDefine,
    sourcemap: false,
    splitting: false,
  },
]);
