import { Hono } from "hono";
import { cors } from "hono/cors";
import { serve } from "@hono/node-server";
import { readFileSync, existsSync } from "fs";
import { resolve, join, extname } from "path";

import tasksRouter from "./routes/tasks";
import questionsRouter from "./routes/questions";
import reviewsRouter from "./routes/reviews";
import dashboardRouter from "./routes/dashboard";
import auditRouter from "./routes/audit";
import mcpRouter from "./routes/mcp";

const MIME_TYPES: Record<string, string> = {
  ".html": "text/html",
  ".js": "application/javascript",
  ".css": "text/css",
  ".json": "application/json",
  ".png": "image/png",
  ".jpg": "image/jpeg",
  ".svg": "image/svg+xml",
  ".ico": "image/x-icon",
  ".woff": "font/woff",
  ".woff2": "font/woff2",
};

export function createApp() {
  const app = new Hono();

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
      ],
      exposeHeaders: [
        "Mcp-Session-Id",
        "Mcp-Protocol-Version",
        "mcp-session-id",
        "mcp-protocol-version",
      ],
    })
  );

  // API routes
  app.route("/api/tasks", tasksRouter);
  app.route("/api/questions", questionsRouter);
  app.route("/api/reviews", reviewsRouter);
  app.route("/api/dashboard", dashboardRouter);
  app.route("/api/audit", auditRouter);

  // Streamable HTTP MCP endpoint
  app.route("/mcp", mcpRouter);
  app.all("/mcp/*", (c) => c.notFound());

  // Static file serving for the React SPA
  const webRoot = resolve(__dirname, "web");

  app.get("*", (c) => {
    // Don't serve static for API or MCP routes
    if (
      c.req.path.startsWith("/api/") ||
      c.req.path === "/mcp" ||
      c.req.path.startsWith("/mcp/")
    ) {
      return c.notFound();
    }

    if (!existsSync(webRoot)) {
      return c.text(
        "Web UI not built yet. Run 'npm run build' to build the frontend.",
        404
      );
    }

    // Try to serve the requested file
    const reqPath = c.req.path === "/" ? "/index.html" : c.req.path;
    const filePath = join(webRoot, reqPath);

    if (existsSync(filePath) && !filePath.includes("..")) {
      const content = readFileSync(filePath);
      const ext = extname(filePath);
      const mime = MIME_TYPES[ext] || "application/octet-stream";
      return new Response(content, {
        headers: { "Content-Type": mime },
      });
    }

    // SPA fallback — serve index.html for client-side routing
    const indexPath = resolve(webRoot, "index.html");
    if (existsSync(indexPath)) {
      const html = readFileSync(indexPath, "utf-8");
      return c.html(html);
    }

    return c.text("Web UI not found.", 404);
  });

  return app;
}

export function startHttpServer(port: number): void {
  const app = createApp();
  serve({ fetch: app.fetch, port }, () => {
    console.log(`Agent Task Board running at http://localhost:${port}`);
  });
}
