import { readFile, writeFile } from "node:fs/promises";

import { Result } from "better-result";
import { z } from "zod";

import { SearchParamsSchema } from "@/discord/schemas.ts";
import { PresetError } from "@/errors.ts";
import { getPresetsFile } from "@/paths.ts";

const PresetSchema = z.object({
  name: z.string(),
  params: SearchParamsSchema,
});

const PresetsArraySchema = z.array(PresetSchema);

/** A named set of validated Discord search parameters. */
export type Preset = z.infer<typeof PresetSchema>;

const consumeStringChars = (
  text: string,
  start: number,
  out: string[]
): number => {
  let i = start;

  while (i < text.length) {
    const ch = text.charAt(i);

    if (ch === "\\") {
      out.push(ch, text.charAt(i + 1));
      i += 2;
    } else if (ch === '"') {
      out.push(ch);

      return i + 1;
    } else {
      out.push(ch);
      i += 1;
    }
  }

  return i;
};

const skipComment = (text: string, start: number): number => {
  if (text.charAt(start + 1) === "/") {
    let i = start;

    while (i < text.length && text.charAt(i) !== "\n") {
      i += 1;
    }

    return i;
  }

  let i = start + 2;

  while (
    i < text.length &&
    !(text.charAt(i) === "*" && text.charAt(i + 1) === "/")
  ) {
    i += 1;
  }

  return i + 2;
};

const parseJsonc = (text: string): Preset[] => {
  const out: string[] = [];
  let i = 0;

  while (i < text.length) {
    const ch = text.charAt(i);

    if (ch === '"') {
      out.push(ch);
      i = consumeStringChars(text, i + 1, out);
    } else if (
      ch === "/" &&
      (text.charAt(i + 1) === "/" || text.charAt(i + 1) === "*")
    ) {
      i = skipComment(text, i);
    } else {
      out.push(ch);
      i += 1;
    }
  }

  return PresetsArraySchema.parse(JSON.parse(out.join("")));
};

/**
 * Load and validate presets from the configured JSON or JSONC file.
 *
 * @returns The loaded presets or a persistence error.
 */
export const loadPresets = async (): Promise<Result<Preset[], PresetError>> =>
  await Result.tryPromise({
    catch: (cause) =>
      new PresetError({
        cause,
        message: `Failed to load presets: ${cause instanceof Error ? cause.message : String(cause)}`,
      }),
    try: async () => {
      const presetsFile = await getPresetsFile();
      let text: string;

      try {
        text = await readFile(presetsFile, "utf-8");
      } catch (error) {
        if (
          error instanceof Error &&
          "code" in error &&
          error.code === "ENOENT"
        ) {
          return [];
        }

        throw error;
      }

      if (presetsFile.endsWith(".jsonc")) {
        return parseJsonc(text);
      }

      const parsed: unknown = z.unknown().parse(JSON.parse(text));

      return PresetsArraySchema.parse(parsed);
    },
  });

/**
 * Add or replace a saved preset.
 *
 * @param name - Preset name.
 * @param params - Validated search parameters to store.
 * @returns Success or a preset persistence error.
 */
export const savePreset = async (
  name: string,
  params: z.infer<typeof SearchParamsSchema>
): Promise<Result<void, PresetError>> =>
  await Result.tryPromise({
    catch: (cause) =>
      new PresetError({
        cause,
        message: `Failed to save preset: ${cause instanceof Error ? cause.message : String(cause)}`,
      }),
    try: async () => {
      const presetsResult = await loadPresets();

      if (!presetsResult.isOk()) {
        throw presetsResult.error;
      }

      const presets = presetsResult.value;

      const index = presets.findIndex((p) => p.name === name);

      if (index === -1) {
        presets.push({ name, params });
      } else {
        presets[index] = { name, params };
      }

      const presetsFile = await getPresetsFile();
      await writeFile(presetsFile, JSON.stringify(presets, null, 2));
    },
  });

/**
 * Delete a saved preset by name.
 *
 * @param name - Name of the preset to delete.
 * @returns Success or a preset persistence error.
 */
export const deletePreset = async (
  name: string
): Promise<Result<void, PresetError>> =>
  await Result.tryPromise({
    catch: (cause) =>
      new PresetError({
        cause,
        message: `Failed to delete preset: ${cause instanceof Error ? cause.message : String(cause)}`,
      }),
    try: async () => {
      const presetsResult = await loadPresets();

      if (!presetsResult.isOk()) {
        throw presetsResult.error;
      }

      const presets = presetsResult.value;
      const filtered = presets.filter((p) => p.name !== name);
      const presetsFile = await getPresetsFile();
      await writeFile(presetsFile, JSON.stringify(filtered, null, 2));
    },
  });
