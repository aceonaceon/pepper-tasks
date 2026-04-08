import { defineConfig } from "tsup";

export default defineConfig({
  entry: { cli: "bin/cli.ts" },
  format: ["cjs"],
  target: "node18",
  outDir: "dist",
  clean: false,
  external: ["better-sqlite3"],
  banner: { js: "#!/usr/bin/env node" },
  sourcemap: false,
  splitting: false,
});
