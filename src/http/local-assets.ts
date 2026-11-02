import type { Context } from "hono";
import { existsSync, readFileSync } from "fs";
import { extname, join, resolve } from "path";

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

export function serveLocalAsset(c: Context): Response {
  const webRoot = findWebRoot();

  if (!existsSync(webRoot)) {
    return c.text(
      "Web UI not built yet. Run 'npm run build' to build the frontend.",
      404
    );
  }

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

  const indexPath = resolve(webRoot, "index.html");
  if (existsSync(indexPath)) {
    const html = readFileSync(indexPath, "utf-8");
    return c.html(html);
  }

  return c.text("Web UI not found.", 404);
}

function findWebRoot(): string {
  const candidates = [
    resolve(__dirname, "public"),
    resolve(__dirname, "web"),
    resolve(process.cwd(), "web", "dist"),
  ];
  return candidates.find((candidate) => existsSync(candidate)) || candidates[0];
}
