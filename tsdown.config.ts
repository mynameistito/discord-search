import { defineConfig } from "tsdown";

export default defineConfig({
  entry: ["src/index.ts"],
  format: ["esm", "cjs"],
  dts: true,
  hash: false,
  clean: true,
  outExtensions: (ctx) => ({
    js: ctx.format === 'esm' ? '.mjs' : '.cjs',
    dts: ctx.format === 'esm' ? '.d.mts' : '.d.cts'
  }),
  deps: {
    alwaysBundle: ["@clack/prompts", "better-result", "zod"],
    onlyBundle: false,
  },
});
