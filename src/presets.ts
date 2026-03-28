import { Result } from "better-result";
import { z } from "zod";
import { SearchParamsSchema } from "@/discord/schemas.ts";
import { PresetError } from "@/errors.ts";
import { PRESETS_FILE } from "@/paths.ts";

const PresetSchema = z.object({
  name: z.string(),
  params: SearchParamsSchema,
});

const PresetsArraySchema = z.array(PresetSchema);

export type Preset = z.infer<typeof PresetSchema>;

export const loadPresets = async (): Promise<Result<Preset[], PresetError>> => {
  return await Result.tryPromise({
    try: async () => {
      const file = Bun.file(PRESETS_FILE);
      const exists = await file.exists();
      if (!exists) {
        return [];
      }
      const text = await file.text();
      const parsed = JSON.parse(text);
      return PresetsArraySchema.parse(parsed);
    },
    catch: (cause) =>
      new PresetError({
        message: `Failed to load presets: ${cause instanceof Error ? cause.message : String(cause)}`,
        cause,
      }),
  });
};

export const savePreset = async (
  name: string,
  params: z.infer<typeof SearchParamsSchema>
): Promise<Result<void, PresetError>> => {
  return await Result.tryPromise({
    try: async () => {
      const presetsResult = await loadPresets();
      if (!presetsResult.isOk()) {
        throw presetsResult.error;
      }
      const presets = presetsResult.value;

      const index = presets.findIndex((p) => p.name === name);
      if (index >= 0) {
        presets[index] = { name, params };
      } else {
        presets.push({ name, params });
      }

      await Bun.write(PRESETS_FILE, JSON.stringify(presets, null, 2));
    },
    catch: (cause) =>
      new PresetError({
        message: `Failed to save preset: ${cause instanceof Error ? cause.message : String(cause)}`,
        cause,
      }),
  });
};

export const deletePreset = async (
  name: string
): Promise<Result<void, PresetError>> => {
  return await Result.tryPromise({
    try: async () => {
      const presetsResult = await loadPresets();
      if (!presetsResult.isOk()) {
        throw presetsResult.error;
      }
      const presets = presetsResult.value;
      const filtered = presets.filter((p) => p.name !== name);
      await Bun.write(PRESETS_FILE, JSON.stringify(filtered, null, 2));
    },
    catch: (cause) =>
      new PresetError({
        message: `Failed to delete preset: ${cause instanceof Error ? cause.message : String(cause)}`,
        cause,
      }),
  });
};
