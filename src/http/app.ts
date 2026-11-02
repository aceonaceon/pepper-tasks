import { serve } from "@hono/node-server";
import { getLocalRepository } from "../db/sqlite-repository";
import { createApp } from "./create-app";
import { serveLocalAsset } from "./local-assets";

export { createApp } from "./create-app";

export function startHttpServer(port: number): void {
  const app = createApp({
    getRepository: () => getLocalRepository(),
    serveAsset: serveLocalAsset,
    mcpStateless: false,
  });

  serve({ fetch: app.fetch, port }, () => {
    console.log(`Agent Task Board running at http://localhost:${port}`);
  });
}
