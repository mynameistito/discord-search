import { defineConfig } from "oxlint";
import antiSlop from "ultracite/oxlint/anti-slop";
import core from "ultracite/oxlint/core";
import { selectJsPlugins } from "ultracite/oxlint/js-plugins";
import landmines from "ultracite/oxlint/landmines";
import vitest from "ultracite/oxlint/vitest";

const jsPlugins = selectJsPlugins(["jsdoc-js", "github", "sonarjs", "tsdoc"]);

export default defineConfig({
  env: core.env,
  extends: [core, vitest, jsPlugins, landmines, antiSlop],
  ignorePatterns: core.ignorePatterns,
  jsPlugins: [...jsPlugins.jsPlugins, ...landmines.jsPlugins],
  options: { typeAware: true },
  rules: { "typescript/consistent-type-definitions": ["error", "type"] },
});
