import { BUILD_COMMIT, BUILD_DIRTY } from "../shared/version";
import { Hono } from "hono";
import { cors } from "hono/cors";
import type { Context } from "hono";

import type { TaskRepository } from "../db/repository";
import tasksRouter from "./routes/tasks";
import questionsRouter from "./routes/questions";
import reviewsRouter from "./routes/reviews";
import dashboardRouter from "./routes/dashboard";
import auditRouter from "./routes/audit";
import { createMcpRouter } from "./routes/mcp";
import type { HttpVariables } from "./types";

export type CreateAppOptions<Bindings extends object = Record<string, unknown>> = {
  getRepository: (
    c: Context<{ Bindings: Bindings; Variables: HttpVariables }>
  ) => TaskRepository;
  serveAsset?: (
    c: Context<{ Bindings: Bindings; Variables: HttpVariables }>
  ) => Response | Promise<Response>;
  mcpStateless?: boolean;
};

export function createApp<Bindings extends object = Record<string, unknown>>(
  options: CreateAppOptions<Bindings>
) {
  type Env = { Bindings: Bindings; Variables: HttpVariables };
  const app = new Hono<Env>();

  app.use(
    "*",
    cors({
      origin: "*",
      allowMethods: ["GET", "POST", "PUT", "DELETE", "OPTIONS"],
      allowHeaders: [
        "Accept",
        "Content-Type",
        "Mcp-Session-Id",
        "Mcp-Protocol-Version",
        "Last-Event-ID",
        "mcp-session-id",
        "mcp-protocol-version",
        "last-event-id",
        "CF-Access-Client-Id",
        "CF-Access-Client-Secret",
        "X-Agent-Task-Board-Token",
      ],
      exposeHeaders: [
        "Mcp-Session-Id",
        "Mcp-Protocol-Version",
        "mcp-session-id",
        "mcp-protocol-version",
      ],
    })
  );

  app.use("*", async (c, next) => {
    c.set("repo", options.getRepository(c));
    await next();
  });

  app.get("/api/version", (c) => c.json({ commit: BUILD_COMMIT, dirty: BUILD_DIRTY }));

  app.route("/api/tasks", tasksRouter);
  app.route("/api/questions", questionsRouter);
  app.route("/api/reviews", reviewsRouter);
  app.route("/api/dashboard", dashboardRouter);
  app.route("/api/audit", auditRouter);
  app.route("/mcp", createMcpRouter({ stateless: options.mcpStateless }));
  app.all("/mcp/*", (c) => c.notFound());

  app.get("*", async (c) => {
    if (
      c.req.path.startsWith("/api/") ||
      c.req.path === "/mcp" ||
      c.req.path.startsWith("/mcp/")
    ) {
      return c.notFound();
    }

    if (options.serveAsset) {
      return options.serveAsset(c);
    }

    return c.notFound();
  });

  return app;
}
