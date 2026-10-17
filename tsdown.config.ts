import { defineConfig } from "tsdown";

export default defineConfig({
  clean: true,
  deps: {
    alwaysBundle: ["@clack/prompts", "better-result", "zod"],
    onlyBundle: false,
  },
  dts: true,
  entry: ["src/index.ts"],
  format: ["esm", "cjs"],
  hash: false,
  outExtensions: (ctx) => ({
    dts: ctx.format === "es" ? ".d.mts" : ".d.cts",
    js: ctx.format === "es" ? ".mjs" : ".cjs",
  }),
});
