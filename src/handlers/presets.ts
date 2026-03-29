import {
  confirm,
  log,
  multiselect,
  select,
  spinner,
  text,
} from "@clack/prompts";
import { matchError } from "better-result";
import { handleCancel, promptForSearchParams } from "@/cli/prompts.ts";
import { collateResults } from "@/collate.ts";
import type { SearchParams } from "@/discord/schemas.ts";
import { searchAllMessages } from "@/discord/search.ts";
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
import {
  deletePreset,
  loadPresets,
  type Preset,
  savePreset,
} from "@/presets.ts";

export const handleManagePresets = async (): Promise<void> => {
  const presetsResult = await loadPresets();
  if (presetsResult.isErr() || presetsResult.value.length === 0) {
    log.info("No presets saved yet.");
    return;
  }

  const presetAction = await select({
    message: "Select a preset to delete:",
    options: [
      ...presetsResult.value.map((p) => ({
        value: p.name,
        label: `${p.name} (guild: ${p.params.guildId})`,
      })),
      { value: "__back__", label: "Back" },
    ],
  });
  handleCancel(presetAction);

  if (presetAction !== "__back__") {
    const name = presetAction as string;
    await deletePreset(name);
    log.success(`Deleted preset: ${name}`);
  }
};

export const resolveSearchParams = async (
  action: string,
  defaultGuildId?: string
): Promise<SearchParams | null> => {
  if (action === "preset") {
    const presetsResult = await loadPresets();
    if (presetsResult.isErr() || presetsResult.value.length === 0) {
      log.info("No presets saved yet. Starting new search.");
      return await promptForSearchParams(defaultGuildId);
    }

    const presetName = await select({
      message: "Select a preset:",
      options: presetsResult.value.map((p) => ({
        value: p.name,
        label: `${p.name} (guild: ${p.params.guildId})`,
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

  const shouldSave = await confirm({
    message: "Save as preset?",
    initialValue: false,
  });
  handleCancel(shouldSave);

  if (shouldSave) {
    const presetName = await text({
      message: "Preset name:",
      validate: (v) => {
        if (!v?.trim()) {
          return "Name is required";
        }
      },
    });
    handleCancel(presetName);
    const savedName = (presetName as string).trim();
    await savePreset(savedName, params);
    log.success(`Saved preset: ${savedName}`);
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
      DiscordApiError: (e) =>
        log.error(`API error (${e.status}): ${e.message}`),
      RateLimitExhaustedError: (e) =>
        log.error(`Rate limited. Try again in ${e.retryAfter}s.`),
      IndexNotReadyError: (e) =>
        log.error(`Index not ready. Try again in ${e.retryAfter}s.`),
      ValidationError: (e) =>
        log.error(`Response validation failed: ${e.message}`),
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

  const dir = `./output/${name}-${timestamp}`;
  await Bun.write(`${dir}/.gitkeep`, "");

  const exports: Promise<unknown>[] = [];
  if (format === "json" || format === "all") {
    exports.push(exportJson(collated, `${dir}/data.json`));
  }
  if (format === "all") {
    exports.push(exportMessagesCsv(collated, `${dir}/messages.csv`));
    exports.push(exportEmbedsCsv(collated, `${dir}/embeds.csv`));
    exports.push(exportFieldsCsv(collated, `${dir}/fields.csv`));
  }
  await Promise.all(exports);
  log.info(`Exported to ${dir}/`);
};

export const handleRunAllPresets = async (token: string): Promise<void> => {
  const presetsResult = await loadPresets();
  if (presetsResult.isErr() || presetsResult.value.length === 0) {
    log.info("No presets saved yet.");
    return;
  }

  const allPresets = presetsResult.value;

  const selected = await multiselect({
    message: "Select presets to run:",
    options: allPresets.map((p) => ({
      value: p.name,
      label: `${p.name} (guild: ${p.params.guildId}${p.params.content ? `, content: ${p.params.content}` : ""})`,
    })),
    required: true,
  });
  handleCancel(selected);

  const selectedNames = new Set(selected as string[]);
  const presets = allPresets.filter((p) => selectedNames.has(p.name));

  log.info(`Running ${presets.length} preset(s) sequentially...`);

  const format = await select({
    message: "Export format for all results:",
    options: [
      { value: "json", label: "JSON (full data)" },
      { value: "all", label: "All formats (JSON + CSVs)" },
      { value: "none", label: "None (just view summaries)" },
    ],
  });
  handleCancel(format);

  const timestamp = new Date().toISOString().replace(/[:.]/g, "-");

  for (let i = 0; i < presets.length; i++) {
    const preset = presets[i];
    if (!preset) {
      continue;
    }

    log.step(`[${i + 1}/${presets.length}] Running preset: ${preset.name}`);
    await runPresetSearch(
      preset.name,
      preset.params,
      token,
      format as string,
      timestamp
    );
  }

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

export const listPresetsNonInteractive = async (): Promise<void> => {
  const presets = await loadPresetsOrExit();
  if (presets.length === 0) {
    process.stdout.write("No presets saved.\n");
    return;
  }
  for (const p of presets) {
    const details = [
      `guild:${p.params.guildId}`,
      p.params.content ? `content:"${p.params.content}"` : "",
      p.params.channelId ? `channels:${p.params.channelId.join(",")}` : "",
    ]
      .filter(Boolean)
      .join(" ");
    process.stdout.write(`${p.name}  ${details}\n`);
  }
};

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

  const timestamp = new Date().toISOString().replace(/[:.]/g, "-");

  for (let i = 0; i < presets.length; i++) {
    const preset = presets[i];
    if (!preset) {
      continue;
    }
    process.stderr.write(
      `[${i + 1}/${presets.length}] Running preset: ${preset.name}\n`
    );

    const result = await searchAllMessages(
      preset.params,
      token,
      (progress) => {
        process.stderr.write(
          `\r  Fetching... (${progress.fetched.toLocaleString()} / ${progress.total.toLocaleString()})`
        );
      }
    );
    process.stderr.write("\n");

    if (result.isErr()) {
      matchError(result.error, {
        DiscordApiError: (e) =>
          process.stderr.write(`  API error (${e.status}): ${e.message}\n`),
        RateLimitExhaustedError: (e) =>
          process.stderr.write(
            `  Rate limited. Try again in ${e.retryAfter}s.\n`
          ),
        IndexNotReadyError: (e) =>
          process.stderr.write(
            `  Index not ready. Try again in ${e.retryAfter}s.\n`
          ),
        ValidationError: (e) =>
          process.stderr.write(`  Response validation failed: ${e.message}\n`),
      });
      continue;
    }

    process.stderr.write(
      `  Found ${result.value.length.toLocaleString()} messages.\n`
    );

    if (result.value.length === 0) {
      continue;
    }

    const collated = collateResults(result.value);

    if (options.export) {
      const dir = options.outputDir
        ? `${options.outputDir}/${preset.name}`
        : `./output/${preset.name}-${timestamp}`;
      await exportNonInteractive(
        collated,
        preset.params.guildId,
        options.export,
        dir
      );
      process.stderr.write(`  Exported to ${dir}/\n`);
    }
  }

  process.stderr.write(`Finished running ${presets.length} preset(s).\n`);
};

export const savePresetNonInteractive = async (
  name: string,
  params: SearchParams
): Promise<void> => {
  if (!params.guildId) {
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
