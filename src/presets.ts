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
      i++;
    }
  }
  return i;
};

const skipComment = (text: string, start: number): number => {
  if (text.charAt(start + 1) === "/") {
    let i = start;
    while (i < text.length && text.charAt(i) !== "\n") {
      i++;
    }
    return i;
  }
  let i = start + 2;
  while (
    i < text.length &&
    !(text.charAt(i) === "*" && text.charAt(i + 1) === "/")
  ) {
    i++;
  }
  return i + 2;
};

const parseJsonc = (text: string): unknown => {
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
      i++;
    }
  }
  return JSON.parse(out.join(""));
};

export const loadPresets = async (): Promise<Result<Preset[], PresetError>> => {
  return await Result.tryPromise({
    try: async () => {
      const presetsFile = await getPresetsFile();
      const file = Bun.file(presetsFile);
      const exists = await file.exists();
      if (!exists) {
        return [];
      }
      const text = await file.text();
      const parsed = presetsFile.endsWith(".jsonc")
        ? parseJsonc(text)
        : JSON.parse(text);
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

      const presetsFile = await getPresetsFile();
      await Bun.write(presetsFile, JSON.stringify(presets, null, 2));
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
      const presetsFile = await getPresetsFile();
      await Bun.write(presetsFile, JSON.stringify(filtered, null, 2));
    },
    catch: (cause) =>
      new PresetError({
        message: `Failed to delete preset: ${cause instanceof Error ? cause.message : String(cause)}`,
        cause,
      }),
  });
};
