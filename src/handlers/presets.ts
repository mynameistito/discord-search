import { mkdir } from "node:fs/promises";

import {
  confirm,
  log,
  multiselect,
  select,
  spinner,
  text,
} from "@clack/prompts";
import type { Result } from "better-result";
import { matchError } from "better-result";
import { z } from "zod";

import {
  handleCancel,
  parseBooleanPrompt,
  parseTextPrompt,
  promptForSearchParams,
} from "@/cli/prompts.ts";
import { collateResults } from "@/collate.ts";
import type { SearchParams } from "@/discord/schemas.ts";
import { searchAllMessages } from "@/discord/search.ts";
import type { ExportError } from "@/errors.ts";
import {
  exportEmbedsCsv,
  exportFieldsCsv,
  exportJson,
  exportMessagesCsv,
} from "@/export.ts";
import { exportNonInteractive } from "@/handlers/export.ts";
import {
  displaySummary,
  executeNonInteractiveSearch,
} from "@/handlers/search.ts";
import { OUTPUT_DIR } from "@/paths.ts";
import { deletePreset, loadPresets, savePreset } from "@/presets.ts";
import type { Preset } from "@/presets.ts";

const MAX_PRESET_DIR_NAME_LENGTH = 100;

const UNSAFE_PATH_CHAR_CODES = new Set([
  0x22, 0x2a, 0x2e, 0x2f, 0x3a, 0x3c, 0x3e, 0x3f, 0x5c, 0x7c,
]);

const isUnsafePathChar = (code: number): boolean =>
  code <= 0x1f || UNSAFE_PATH_CHAR_CODES.has(code);

const formatPresetOptionLabel = (preset: Preset): string => {
  const { content } = preset.params;

  const contentSummary =
    content === undefined || content.length === 0
      ? ""
      : `, content: ${content}`;

  return `${preset.name} (guild: ${preset.params.guildId}${contentSummary})`;
};

const logApiError = (error: { status: number; message: string }): void => {
  log.error(`API error (${error.status}): ${error.message}`);
};

const logIndexError = (error: { retryAfter: number }): void => {
  log.error(`Index not ready. Try again in ${error.retryAfter}s.`);
};

const logRateLimitError = (error: { retryAfter: number }): void => {
  log.error(`Rate limited. Try again in ${error.retryAfter}s.`);
};

const logValidationError = (error: { message: string }): void => {
  log.error(`Response validation failed: ${error.message}`);
};

const sanitizePresetDirName = (name: string): string => {
  let sanitized = "";

  for (const character of name) {
    if (sanitized.length >= MAX_PRESET_DIR_NAME_LENGTH) {
      break;
    }

    const code = character.codePointAt(0) ?? 0;
    sanitized += isUnsafePathChar(code) ? "-" : character;
  }

  if (!sanitized || sanitized === "-") {
    return "preset";
  }

  return sanitized;
};

/** Display saved presets and allow the user to delete one.
 *
 * @returns When the user returns to the previous menu.
 */
export const handleManagePresets = async (): Promise<void> => {
  const presetsResult = await loadPresets();

  if (presetsResult.isErr()) {
    log.error(`Failed to load presets: ${presetsResult.error.message}`);

    return;
  }

  if (presetsResult.value.length === 0) {
    log.info("No presets saved yet.");

    return;
  }

  const presetAction = await select({
    message: "Select a preset to delete:",
    options: [
      ...presetsResult.value.map((p) => ({
        label: `${p.name} (guild: ${p.params.guildId})`,
        value: p.name,
      })),
      { label: "Back", value: "__back__" },
    ],
  });

  handleCancel(presetAction);

  if (presetAction !== "__back__") {
    const name = parseTextPrompt(presetAction);
    const result = await deletePreset(name);

    if (result.isErr()) {
      log.error(`Failed to delete preset: ${result.error.message}`);

      return;
    }

    log.success(`Deleted preset: ${name}`);
  }
};

/**
 * Resolve a search preset or prompt for new search parameters.
 *
 * @param action - Selected source for the search parameters.
 * @param defaultGuildId - Optional guild ID to prefill.
 * @returns Search parameters, or null when resolution is cancelled.
 */
export const resolveSearchParams = async (
  action: string,
  defaultGuildId?: string
): Promise<SearchParams | null> => {
  if (action === "preset") {
    const presetsResult = await loadPresets();

    if (presetsResult.isErr()) {
      log.error(`Failed to load presets: ${presetsResult.error.message}`);

      return null;
    }

    if (presetsResult.value.length === 0) {
      log.info("No presets saved yet. Starting new search.");

      return await promptForSearchParams(defaultGuildId);
    }

    const presetName = await select({
      message: "Select a preset:",
      options: presetsResult.value.map((p) => ({
        label: `${p.name} (guild: ${p.params.guildId})`,
        value: p.name,
      })),
    });

    handleCancel(presetName);

    const preset = presetsResult.value.find((p) => p.name === presetName);

    if (!preset) {
      log.error("Preset not found.");

      return null;
    }

    log.info(`Loaded preset: ${preset.name}`);

    return preset.params;
  }

  const params = await promptForSearchParams(defaultGuildId);

  const shouldSave = parseBooleanPrompt(
    await confirm({
      initialValue: false,
      message: "Save as preset?",
    })
  );

  if (shouldSave) {
    const presetName = parseTextPrompt(
      await text({
        message: "Preset name:",
        validate: (value) =>
          value !== undefined && value.trim().length > 0
            ? undefined
            : "Name is required",
      })
    );

    const savedName = presetName.trim();
    const result = await savePreset(savedName, params);

    if (result.isErr()) {
      log.error(`Failed to save preset: ${result.error.message}`);
    } else {
      log.success(`Saved preset: ${savedName}`);
    }
  }

  return params;
};

const runPresetSearch = async (
  name: string,
  params: SearchParams,
  token: string,
  format: string,
  timestamp: string
): Promise<void> => {
  const s = spinner();
  s.start(`Searching: ${name}...`);

  const result = await searchAllMessages(params, token, (progress) => {
    s.message(
      `[${name}] Fetching... (${progress.fetched.toLocaleString()} / ${progress.total.toLocaleString()})`
    );
  });

  if (result.isErr()) {
    s.stop(`Search failed for: ${name}`);
    matchError(result.error, {
      DiscordApiError: logApiError,
      IndexNotReadyError: logIndexError,
      RateLimitExhaustedError: logRateLimitError,
      ValidationError: logValidationError,
    });

    return;
  }

  s.stop(`[${name}] Found ${result.value.length.toLocaleString()} messages.`);

  if (result.value.length === 0) {
    return;
  }

  const collated = collateResults(result.value);
  displaySummary(collated);

  if (format === "none") {
    return;
  }

  const dir = `${OUTPUT_DIR}/${sanitizePresetDirName(name)}-${timestamp}`;
  await mkdir(dir, { recursive: true });

  const exports: Promise<Result<void, ExportError>>[] = [];

  if (format === "json" || format === "all") {
    exports.push(exportJson(collated, `${dir}/data.json`));
  }

  if (format === "all") {
    exports.push(
      exportMessagesCsv(collated, `${dir}/messages.csv`),
      exportEmbedsCsv(collated, `${dir}/embeds.csv`),
      exportFieldsCsv(collated, `${dir}/fields.csv`)
    );
  }

  const results = await Promise.all(exports);
  const failed = results.find((r) => r.isErr());

  if (failed) {
    log.error(`Export failed for ${name}: ${failed.error.message}`);

    return;
  }

  log.info(`Exported to ${dir}/`);
};

/** Run every saved preset interactively.
 *
 * @param token - Discord bot token used for each search.
 * @returns A promise that resolves when preset processing is complete.
 */
export const handleRunAllPresets = async (token: string): Promise<void> => {
  const presetsResult = await loadPresets();

  if (presetsResult.isErr()) {
    log.error(`Failed to load presets: ${presetsResult.error.message}`);

    return;
  }

  if (presetsResult.value.length === 0) {
    log.info("No presets saved yet.");

    return;
  }

  const allPresets = presetsResult.value;

  const selected = await multiselect({
    message: "Select presets to run:",
    options: allPresets.map((p) => ({
      label: formatPresetOptionLabel(p),
      value: p.name,
    })),
    required: true,
  });

  handleCancel(selected);

  const selectedNames = new Set(z.array(z.string()).parse(selected));
  const presets = allPresets.filter((p) => selectedNames.has(p.name));

  log.info(`Running ${presets.length} preset(s) sequentially...`);

  const format = await select({
    message: "Export format for all results:",
    options: [
      { label: "JSON (full data)", value: "json" },
      { label: "All formats (JSON + CSVs)", value: "all" },
      { label: "None (just view summaries)", value: "none" },
    ],
  });

  handleCancel(format);

  const timestamp = new Date().toISOString().replaceAll(/[:.]/gu, "-");

  const exportFormat = z.enum(["json", "all", "none"]).parse(format);

  const runPresetAt = async (index: number): Promise<void> => {
    const preset = presets[index];

    if (preset === undefined) {
      return;
    }

    log.step(`[${index + 1}/${presets.length}] Running preset: ${preset.name}`);
    await runPresetSearch(
      preset.name,
      preset.params,
      token,
      exportFormat,
      timestamp
    );

    await runPresetAt(index + 1);
  };

  await runPresetAt(0);

  log.success(`Finished running all ${presets.length} preset(s).`);
};

// --- Non-interactive preset operations ---

const loadPresetsOrExit = async (): Promise<Preset[]> => {
  const result = await loadPresets();

  if (result.isErr()) {
    process.stderr.write("Failed to load presets.\n");
    process.exit(1);
  }

  return result.value;
};

const findPresetOrExit = (presets: Preset[], name: string): Preset => {
  const preset = presets.find((p) => p.name === name);

  if (!preset) {
    process.stderr.write(`Preset not found: ${name}\n`);
    process.exit(1);
  }

  return preset;
};

/** List saved presets and their primary search filters. */
export const listPresetsNonInteractive = async (): Promise<void> => {
  const presets = await loadPresetsOrExit();

  if (presets.length === 0) {
    process.stdout.write("No presets saved.\n");

    return;
  }

  for (const p of presets) {
    const details = [
      `guild:${p.params.guildId}`,
      p.params.content === undefined || p.params.content.length === 0
        ? ""
        : `content:"${p.params.content}"`,
      p.params.channelId === undefined || p.params.channelId.length === 0
        ? ""
        : `channels:${p.params.channelId.join(",")}`,
    ]
      .filter(Boolean)
      .join(" ");

    process.stdout.write(`${p.name}  ${details}\n`);
  }
};

/** Run one saved preset without interactive prompts.
 *
 * @param name - Preset name to execute.
 * @param token - Discord bot token.
 * @param options - Output and export options.
 * @returns A promise that resolves after search execution.
 */
export const runPresetNonInteractive = async (
  name: string,
  token: string,
  options: { export?: string; outputDir?: string; json: boolean }
): Promise<void> => {
  const presets = await loadPresetsOrExit();
  const preset = findPresetOrExit(presets, name);
  process.stderr.write(`Running preset: ${preset.name}\n`);
  await executeNonInteractiveSearch(preset.params, token, options);
};

const tryExportPreset = async (
  collated: ReturnType<typeof collateResults>,
  preset: Preset,
  options: { export: string; outputDir?: string },
  timestamp: string
): Promise<void> => {
  try {
    const safeName = sanitizePresetDirName(preset.name);

    const dir =
      options.outputDir === undefined
        ? `${OUTPUT_DIR}/${safeName}-${timestamp}`
        : `${options.outputDir}/${safeName}`;

    await exportNonInteractive(
      collated,
      preset.params.guildId,
      options.export,
      dir
    );
    process.stderr.write(`  Exported to ${dir}/\n`);
  } catch (error) {
    process.stderr.write(
      `  Export failed: ${error instanceof Error ? error.message : String(error)}\n`
    );
  }
};

const reportApiError = (error: { status: number; message: string }): void => {
  process.stderr.write(`  API error (${error.status}): ${error.message}\n`);
};

const reportIndexError = (error: { retryAfter: number }): void => {
  process.stderr.write(
    `  Index not ready. Try again in ${error.retryAfter}s.\n`
  );
};

const reportRateLimitError = (error: { retryAfter: number }): void => {
  process.stderr.write(`  Rate limited. Try again in ${error.retryAfter}s.\n`);
};

const reportValidationError = (error: { message: string }): void => {
  process.stderr.write(`  Response validation failed: ${error.message}\n`);
};

/** Run selected presets without interactive prompts.
 *
 * @param names - Preset names to run when `all` is false.
 * @param all - Whether every saved preset should run.
 * @param token - Discord bot token.
 * @param options - Optional output and export settings.
 * @returns A promise that resolves when all presets have completed.
 */
export const runAllPresetsNonInteractive = async (
  names: string[],
  all: boolean,
  token: string,
  options: { export?: string; outputDir?: string }
): Promise<void> => {
  const allPresets = await loadPresetsOrExit();

  if (allPresets.length === 0) {
    process.stderr.write("No presets saved.\n");

    return;
  }

  const presets = all
    ? allPresets
    : names.map((name) => findPresetOrExit(allPresets, name));

  if (presets.length === 0) {
    process.stderr.write("No presets selected.\n");

    return;
  }

  const timestamp = new Date().toISOString().replaceAll(/[:.]/gu, "-");

  const runPresetAt = async (index: number): Promise<void> => {
    const preset = presets[index];

    if (preset === undefined) {
      return;
    }

    process.stderr.write(
      `[${index + 1}/${presets.length}] Running preset: ${preset.name}\n`
    );

    const result = await searchAllMessages(preset.params, token, (progress) => {
      process.stderr.write(
        `\r  Fetching... (${progress.fetched.toLocaleString()} / ${progress.total.toLocaleString()})`
      );
    });

    process.stderr.write("\n");

    if (result.isErr()) {
      matchError(result.error, {
        DiscordApiError: reportApiError,
        IndexNotReadyError: reportIndexError,
        RateLimitExhaustedError: reportRateLimitError,
        ValidationError: reportValidationError,
      });
    } else {
      process.stderr.write(
        `  Found ${result.value.length.toLocaleString()} messages.\n`
      );

      if (result.value.length > 0 && options.export !== undefined) {
        await tryExportPreset(
          collateResults(result.value),
          preset,
          { export: options.export, outputDir: options.outputDir },
          timestamp
        );
      }
    }

    await runPresetAt(index + 1);
  };

  await runPresetAt(0);

  process.stderr.write(`Finished running ${presets.length} preset(s).\n`);
};

/** Save a preset from a non-interactive CLI command.
 *
 * @param name - Preset name.
 * @param params - Validated search parameters to save.
 * @returns A promise that resolves after persistence.
 */
export const savePresetNonInteractive = async (
  name: string,
  params: SearchParams
): Promise<void> => {
  if (params.guildId.length === 0) {
    process.stderr.write("Error: --guild is required when saving a preset.\n");
    process.exit(1);
  }

  const result = await savePreset(name, params);

  if (result.isErr()) {
    process.stderr.write(`Failed to save preset: ${name}\n`);
    process.exit(1);
  }

  process.stderr.write(`Saved preset: ${name}\n`);
};

/** Delete a preset from a non-interactive CLI command.
 *
 * @param name - Preset name to delete.
 * @returns A promise that resolves after deletion.
 */
export const deletePresetNonInteractive = async (
  name: string
): Promise<void> => {
  const result = await deletePreset(name);

  if (result.isErr()) {
    process.stderr.write(`Failed to delete preset: ${name}\n`);
    process.exit(1);
  }

  process.stderr.write(`Deleted preset: ${name}\n`);
};
