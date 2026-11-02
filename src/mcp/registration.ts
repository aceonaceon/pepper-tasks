import type { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import type { z } from "zod";

type TextResult = { content: { type: "text"; text: string }[]; isError?: boolean };

/** Keep the deployed Zod 3 validators without expanding the SDK's Zod 3/4 overload union. */
export function registerLegacyTool<Shape extends z.ZodRawShape>(
  server: McpServer, name: string, description: string, schema: Shape,
  handler: (params: z.infer<z.ZodObject<Shape>>) => Promise<TextResult>,
): void {
  type Register = (name: string, description: string, schema: Shape, callback: typeof handler) => unknown;
  (server as unknown as { tool: Register }).tool(name, description, schema, handler);
}

/** Only retirement uses a strict object; existing tools retain their deployed stripping behavior. */
export function registerStrictTool<Args>(
  server: McpServer, name: string,
  config: { description: string; inputSchema: z.ZodType<Args> },
  handler: (params: Args) => Promise<TextResult>,
): void {
  type Register = (name: string, options: typeof config, callback: typeof handler) => unknown;
  (server as unknown as { registerTool: Register }).registerTool(name, config, handler);
}
