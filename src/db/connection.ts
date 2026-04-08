import Database from "better-sqlite3";
import { mkdirSync } from "fs";
import { dirname, join, resolve } from "path";
import { homedir } from "os";
import { execSync } from "child_process";
import { initializeSchema } from "./schema";

let db: Database.Database | null = null;

function getDbPath(): string {
  if (process.env.ATB_DB_PATH) return process.env.ATB_DB_PATH;
  return join(homedir(), ".agent-task-board", "data.db");
}

function isNativeModuleError(err: any): boolean {
  const msg = err?.message || "";
  return (
    (err?.code === "ERR_DLOPEN_FAILED" && msg.includes("NODE_MODULE_VERSION")) ||
    msg.includes("was compiled against a different Node.js version")
  );
}

function rebuildBetterSqlite3(): void {
  process.stderr.write(
    "[agent-task-board] Node.js version mismatch detected for better-sqlite3.\n" +
      "[agent-task-board] Auto-rebuilding native module for current Node " +
      process.version +
      "...\n"
  );

  const bsPkgPath = require.resolve("better-sqlite3/package.json");
  const bsDir = dirname(bsPkgPath);
  const packageRoot = resolve(bsDir, "..", "..");
  const nodeDir = dirname(process.execPath);

  // 1. Delete old build so prebuild-install is forced to re-download
  const { rmSync } = require("fs");
  try {
    rmSync(resolve(bsDir, "build"), { recursive: true, force: true });
  } catch {}

  // 2. Find npm-cli.js co-located with current Node binary
  const npmCliPath = resolve(nodeDir, "..", "lib", "node_modules", "npm", "bin", "npm-cli.js");
  let rebuildCmd: string;
  try {
    const { statSync } = require("fs");
    statSync(npmCliPath);
    rebuildCmd = `"${process.execPath}" "${npmCliPath}" rebuild better-sqlite3`;
  } catch {
    rebuildCmd = `npm rebuild better-sqlite3`;
  }

  // 3. Run rebuild with PATH restricted to current Node's bin dir.
  //    This ensures ALL child processes (prebuild-install, node-gyp)
  //    use the same Node version, not whatever nvm/system has on PATH.
  execSync(rebuildCmd, {
    cwd: packageRoot,
    stdio: ["ignore", "ignore", "inherit"],
    env: {
      ...process.env,
      PATH: `${nodeDir}:/usr/bin:/bin`,
    },
  });

  process.stderr.write(
    "[agent-task-board] Rebuild successful!\n"
  );

  // Clear ALL cached modules related to better-sqlite3 and bindings
  for (const key of Object.keys(require.cache)) {
    if (
      key.includes("better-sqlite3") ||
      key.includes("better_sqlite3") ||
      key.includes("bindings")
    ) {
      delete require.cache[key];
    }
  }
}

/**
 * Try to open SQLite database.
 * If better-sqlite3 native addon doesn't match current Node ABI,
 * auto-rebuild and retry.
 */
function openDatabase(dbPath: string): Database.Database {
  try {
    return new Database(dbPath);
  } catch (err: any) {
    if (!isNativeModuleError(err)) throw err;

    try {
      rebuildBetterSqlite3();

      // Re-require the module fresh after rebuild
      const FreshDatabase = require("better-sqlite3");
      return new FreshDatabase(dbPath);
    } catch (retryErr: any) {
      // If retry also fails, give helpful guidance
      if (isNativeModuleError(retryErr)) {
        process.stderr.write(
          "[agent-task-board] Auto-rebuild did not resolve the issue.\n" +
            "[agent-task-board] Please try:\n" +
            "[agent-task-board]   1. npm rebuild better-sqlite3\n" +
            "[agent-task-board]   2. agent-task-board config  (generate MCP config with correct Node path)\n" +
            "[agent-task-board]   3. npm install -g agent-task-board  (reinstall)\n"
        );
      }
      throw retryErr;
    }
  }
}

export function getDb(): Database.Database {
  if (db) return db;

  const dbPath = getDbPath();
  mkdirSync(dirname(dbPath), { recursive: true });

  db = openDatabase(dbPath);
  db.pragma("journal_mode = WAL");
  db.pragma("busy_timeout = 5000");
  db.pragma("foreign_keys = ON");

  initializeSchema(db);
  return db;
}

export function closeDb(): void {
  if (db) {
    db.close();
    db = null;
  }
}
