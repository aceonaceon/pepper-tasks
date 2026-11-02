import { D1TaskRepository } from "./db/d1-repository";
import { createApp } from "./http/create-app";

export type Env = {
  DB: D1Database;
  ASSETS: Fetcher;
  IMPORT_TOKEN?: string;
  TEMP_ACCESS_TOKEN?: string;
};

const TEMP_ACCESS_HEADER = "x-agent-task-board-token";
const TEMP_ACCESS_COOKIE = "atb_token";

const app = createApp<Env>({
  getRepository: (c) => new D1TaskRepository(c.env.DB),
  serveAsset: (c) => c.env.ASSETS.fetch(c.req.raw),
  mcpStateless: true,
});

export default {
  async fetch(request: Request, env: Env, ctx: Parameters<typeof app.fetch>[2]) {
    const adminResponse = await handleAdminImport(request, env);
    if (adminResponse) return adminResponse;

    if (request.method !== "OPTIONS") {
      const temporaryAccessResponse = handleTemporaryAccess(request, env);
      if (temporaryAccessResponse) return temporaryAccessResponse;
    }

    return app.fetch(request, env, ctx);
  },
};

function handleTemporaryAccess(request: Request, env: Env): Response | null {
  const expectedToken = env.TEMP_ACCESS_TOKEN;
  if (!expectedToken) return null;

  const url = new URL(request.url);
  if (url.pathname === "/__unlock") {
    const suppliedToken =
      url.searchParams.get("token") ?? request.headers.get(TEMP_ACCESS_HEADER);
    if (!tokensMatch(suppliedToken, expectedToken)) {
      return lockedResponse();
    }

    const next = safeRedirectPath(url.searchParams.get("next"));
    return new Response(null, {
      status: 302,
      headers: {
        "Cache-Control": "no-store",
        Location: next,
        "Set-Cookie": `${TEMP_ACCESS_COOKIE}=${encodeURIComponent(
          expectedToken
        )}; HttpOnly; Secure; SameSite=Lax; Path=/; Max-Age=604800`,
      },
    });
  }

  const headerToken = request.headers.get(TEMP_ACCESS_HEADER);
  const cookieToken = readCookie(request.headers.get("Cookie"), TEMP_ACCESS_COOKIE);
  if (tokensMatch(headerToken, expectedToken) || tokensMatch(cookieToken, expectedToken)) {
    return null;
  }

  return lockedResponse();
}

function lockedResponse(): Response {
  return new Response("Locked until Cloudflare Access is configured", {
    status: 401,
    headers: {
      "Cache-Control": "no-store",
      "Content-Type": "text/plain;charset=UTF-8",
    },
  });
}

function safeRedirectPath(value: string | null): string {
  if (!value || !value.startsWith("/") || value.startsWith("//")) return "/";
  return value;
}

function readCookie(header: string | null, name: string): string | null {
  if (!header) return null;
  for (const cookie of header.split(";")) {
    const [rawName, ...rawValue] = cookie.trim().split("=");
    if (rawName === name) {
      return decodeURIComponent(rawValue.join("="));
    }
  }
  return null;
}

function tokensMatch(actual: string | null | undefined, expected: string): boolean {
  if (!actual || actual.length !== expected.length) return false;

  let diff = 0;
  for (let index = 0; index < expected.length; index += 1) {
    diff |= actual.charCodeAt(index) ^ expected.charCodeAt(index);
  }
  return diff === 0;
}

async function handleAdminImport(
  request: Request,
  env: Env
): Promise<Response | null> {
  const url = new URL(request.url);
  if (!url.pathname.startsWith("/__admin/import")) return null;

  if (!env.IMPORT_TOKEN) return new Response("Not found", { status: 404 });
  if (request.headers.get("x-import-token") !== env.IMPORT_TOKEN) {
    return new Response("Forbidden", { status: 403 });
  }

  if (request.method !== "POST") {
    return new Response("Method not allowed", { status: 405 });
  }

  if (url.pathname === "/__admin/import/reset") {
    await env.DB.batch([
      env.DB.prepare("DELETE FROM audit_logs"),
      env.DB.prepare("DELETE FROM reviews"),
      env.DB.prepare("DELETE FROM questions"),
      env.DB.prepare("DELETE FROM tasks"),
    ]);
    return Response.json({ ok: true });
  }

  if (url.pathname !== "/__admin/import/batch") return new Response("Not found", { status: 404 });

  const body = (await request.json()) as {
    table?: string;
    rows?: Record<string, unknown>[];
  };
  const rows = body.rows ?? [];
  if (rows.length === 0) return Response.json({ ok: true, inserted: 0 });

  const statements = rows.map((row) => createInsert(env.DB, body.table, row));
  await env.DB.batch(statements);
  return Response.json({ ok: true, inserted: rows.length });
}

function createInsert(
  db: D1Database,
  table: string | undefined,
  row: Record<string, unknown>
): D1PreparedStatement {
  switch (table) {
    case "tasks":
      return db
        .prepare(
          `INSERT INTO tasks (id,title,description,created_by,assigned_to,status,quadrant,task_type,deadline,parent_task_id,created_at,updated_at)
           VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`
        )
        .bind(
          sql(row.id),
          sql(row.title),
          sql(row.description),
          sql(row.created_by),
          sql(row.assigned_to),
          sql(row.status),
          sql(row.quadrant),
          sql(row.task_type),
          sql(row.deadline),
          sql(row.parent_task_id),
          sql(row.created_at),
          sql(row.updated_at)
        );
    case "questions":
      return db
        .prepare(
          `INSERT INTO questions (id,task_id,created_by,assigned_to,question_type,question_text,description,options,answer,status,created_at,answered_at)
           VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`
        )
        .bind(
          sql(row.id),
          sql(row.task_id),
          sql(row.created_by),
          sql(row.assigned_to),
          sql(row.question_type),
          sql(row.question_text),
          sql(row.description),
          sql(row.options),
          sql(row.answer),
          sql(row.status),
          sql(row.created_at),
          sql(row.answered_at)
        );
    case "reviews":
      return db
        .prepare(
          `INSERT INTO reviews (id,task_id,reviewer,approved,comment,created_at)
           VALUES (?, ?, ?, ?, ?, ?)`
        )
        .bind(
          sql(row.id),
          sql(row.task_id),
          sql(row.reviewer),
          sql(row.approved),
          sql(row.comment),
          sql(row.created_at)
        );
    case "audit_logs":
      return db
        .prepare(
          `INSERT INTO audit_logs (id,task_id,actor,action,old_value,new_value,timestamp)
           VALUES (?, ?, ?, ?, ?, ?, ?)`
        )
        .bind(
          sql(row.id),
          sql(row.task_id),
          sql(row.actor),
          sql(row.action),
          sql(row.old_value),
          sql(row.new_value),
          sql(row.timestamp)
        );
    default:
      throw new Error(`Unsupported import table: ${table}`);
  }
}

function sql(value: unknown): string | number | boolean | null {
  if (
    typeof value === "string" ||
    typeof value === "number" ||
    typeof value === "boolean" ||
    value === null
  ) {
    return value;
  }
  if (value === undefined) return null;
  throw new Error(`Unsupported import value: ${String(value)}`);
}
