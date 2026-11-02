import { defineConfig } from "tsup";

export default defineConfig([
  {
    entry: { cli: "bin/cli.ts" },
    format: ["cjs"],
    target: "node18",
    outDir: "dist",
    clean: false,
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
    sourcemap: false,
    splitting: false,
  },
]);
