import { resolve } from "path";
import { closeDb } from "../src/db/connection";

const args = process.argv.slice(2);
const command = args[0] || "start";

// Parse flags
function getFlag(name: string, defaultValue: string): string {
  const idx = args.indexOf(`--${name}`);
  if (idx !== -1 && args[idx + 1]) return args[idx + 1];
  return defaultValue;
}

// Set DB path from flag if provided
const dbPath = getFlag("db-path", "");
if (dbPath) process.env.ATB_DB_PATH = dbPath;

// Graceful shutdown
function setupShutdown(): void {
  const shutdown = () => {
    closeDb();
    process.exit(0);
  };
  process.on("SIGINT", shutdown);
  process.on("SIGTERM", shutdown);
}

async function main(): Promise<void> {
  setupShutdown();

  switch (command) {
    case "start": {
      const port = parseInt(getFlag("port", "3847"), 10);
      const { startHttpServer } = await import("../src/http/app");
      // Initialize DB eagerly
      const { getDb } = await import("../src/db/connection");
      getDb();
      startHttpServer(port);
      break;
    }
    case "mcp": {
      // In MCP mode, suppress console.log (stdout is for protocol only)
      const originalLog = console.log;
      console.log = (...args: unknown[]) => {
        process.stderr.write(args.map(String).join(" ") + "\n");
      };
      const { getDb } = await import("../src/db/connection");
      getDb();
      const { startMcpServer } = await import("../src/mcp/server");
      await startMcpServer();
      break;
    }
    case "service": {
      const subCmd = args[1];
      const port = parseInt(getFlag("port", "3847"), 10);
      const { serviceInstall, serviceUninstall, serviceStatus } = await import(
        "../src/service"
      );
      switch (subCmd) {
        case "install":
          serviceInstall(port);
          break;
        case "uninstall":
          serviceUninstall();
          break;
        case "status":
          serviceStatus();
          break;
        default:
          console.error("Usage: agent-task-board service [install|uninstall|status] [--port 3847]");
          process.exit(1);
      }
      process.exit(0);
    }
    case "config": {
      // Output MCP config JSON using the exact Node binary that's running right now.
      // This guarantees native addons (better-sqlite3) will be compatible,
      // because the same Node that ran `npm install` is used to start MCP.
      const cliPath = resolve(__dirname, "cli.js");
      const config = {
        "task-board": {
          command: process.execPath,
          args: [cliPath, "mcp"],
        },
      };
      console.log(JSON.stringify(config, null, 2));
      process.exit(0);
    }
    default:
      console.error(`Unknown command: ${command}`);
      console.error(
        "Usage:\n" +
          "  agent-task-board start    [--port 3847]              Start Web UI\n" +
          "  agent-task-board mcp                                 Start MCP Server (stdio)\n" +
          "  agent-task-board config                              Output MCP config JSON\n" +
          "  agent-task-board service  [install|uninstall|status] System service management\n"
      );
      process.exit(1);
  }
}

main().catch((err) => {
  console.error("Fatal error:", err);
  closeDb();
  process.exit(1);
});
