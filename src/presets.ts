import { Result } from "better-result";
import type { SearchParams } from "@/discord/schemas.ts";
import { ExportError } from "@/errors.ts";

const PRESETS_FILE = ".discord-search-presets.json";

export type Preset = {
  name: string;
  params: SearchParams;
};

export const loadPresets = async (): Promise<Result<Preset[], ExportError>> => {
  return await Result.tryPromise({
    try: async () => {
      const file = Bun.file(PRESETS_FILE);
      const exists = await file.exists();
      if (!exists) {
        return [];
      }
      const text = await file.text();
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

      // Replace existing preset with same name or add new
      const index = presets.findIndex((p) => p.name === name);
      if (index >= 0) {
        presets[index] = { name, params };
      } else {
        presets.push({ name, params });
      }

      await Bun.write(PRESETS_FILE, JSON.stringify(presets, null, 2));
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
      await Bun.write(PRESETS_FILE, JSON.stringify(filtered, null, 2));
    },
    catch: (cause) =>
      new ExportError({
        message: `Failed to delete preset: ${cause instanceof Error ? cause.message : String(cause)}`,
        cause,
      }),
  });
};
