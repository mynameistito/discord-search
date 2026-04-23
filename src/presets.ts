import { Result } from "better-result";
import { parse as parseJsonc } from "jsonc-parser";
import type { SearchParams } from "@/discord/schemas.ts";
import { ExportError } from "@/errors.ts";
import { fileExists, readTextFile, writeTextFile } from "@/fs.ts";

const PRESETS_FILE_JSONC = ".discord-search-presets.jsonc";
const PRESETS_FILE = ".discord-search-presets.json";

export type Preset = {
  name: string;
  params: SearchParams;
};

const resolvePresetsFile = async (): Promise<string> => {
  if (await fileExists(PRESETS_FILE_JSONC)) {
    return PRESETS_FILE_JSONC;
  }
  return PRESETS_FILE;
};

export const loadPresets = async (): Promise<Result<Preset[], ExportError>> => {
  return await Result.tryPromise({
    try: async () => {
      if (await fileExists(PRESETS_FILE_JSONC)) {
        const text = await readTextFile(PRESETS_FILE_JSONC);
        return parseJsonc(text) as Preset[];
      }
      if (!(await fileExists(PRESETS_FILE))) {
        return [];
      }
      const text = await readTextFile(PRESETS_FILE);
      return JSON.parse(text) as Preset[];
    },
    catch: (cause) =>
      new ExportError({
        message: `Failed to load presets: ${cause instanceof Error ? cause.message : String(cause)}`,
        cause,
      }),
  });
};

export const savePreset = async (
  name: string,
  params: SearchParams
): Promise<Result<void, ExportError>> => {
  return await Result.tryPromise({
    try: async () => {
      const presetsResult = await loadPresets();
      const presets = presetsResult.isOk() ? presetsResult.value : [];

      const index = presets.findIndex((p) => p.name === name);
      if (index >= 0) {
        presets[index] = { name, params };
      } else {
        presets.push({ name, params });
      }

      const file = await resolvePresetsFile();
      await writeTextFile(file, JSON.stringify(presets, null, 2));
    },
    catch: (cause) =>
      new ExportError({
        message: `Failed to save preset: ${cause instanceof Error ? cause.message : String(cause)}`,
        cause,
      }),
  });
};

export const deletePreset = async (
  name: string
): Promise<Result<void, ExportError>> => {
  return await Result.tryPromise({
    try: async () => {
      const presetsResult = await loadPresets();
      const presets = presetsResult.isOk() ? presetsResult.value : [];
      const filtered = presets.filter((p) => p.name !== name);
      const file = await resolvePresetsFile();
      await writeTextFile(file, JSON.stringify(filtered, null, 2));
    },
    catch: (cause) =>
      new ExportError({
        message: `Failed to delete preset: ${cause instanceof Error ? cause.message : String(cause)}`,
        cause,
      }),
  });
};
