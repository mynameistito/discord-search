import { readFile, writeFile } from "node:fs/promises";

import { Effect, Schema } from "effect";

import { SearchParamsSchema } from "@/discord/schemas.ts";
import type { SearchParams } from "@/discord/schemas.ts";
import { PresetError } from "@/errors.ts";
import { getPresetsFile } from "@/paths.ts";

const PresetSchema = Schema.Struct({
  name: Schema.String,
  params: SearchParamsSchema,
});

const PresetsText = Schema.fromJsonString(Schema.Array(PresetSchema));

/** A named set of validated Discord search parameters. */
export type Preset = typeof PresetSchema.Type;

const consumeStringChars = (text: string, start: number, out: string[]) => {
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

const skipComment = (text: string, start: number) => {
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

const stripJsoncComments = (text: string) => {
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

  return out.join("");
};

const readPresets = Effect.fn("Presets.readFile")(function* readPresets(
  path: string
) {
  const text = yield* Effect.tryPromise({
    try: async () => await readFile(path, "utf-8"),
    catch: (error) => error,
  }).pipe(
    Effect.catchIf(
      (error) =>
        error instanceof Error && "code" in error && error.code === "ENOENT",
      () => Effect.succeed("[]")
    )
  );

  return yield* Schema.decodeUnknownEffect(PresetsText)(
    path.endsWith(".jsonc") ? stripJsoncComments(text) : text
  );
});

const resolvePath = Effect.tryPromise({
  try: async () => await getPresetsFile(),
  catch: (cause) => cause,
});

const writePresets = (path: string, presets: readonly Preset[]) =>
  Effect.tryPromise({
    try: async () => {
      await writeFile(path, JSON.stringify(presets, null, 2));
    },
    catch: (cause) => cause,
  });

const presetError = (operation: string) =>
  Effect.mapError(
    (cause: unknown) =>
      new PresetError({
        cause,
        message: `Failed to ${operation}: ${cause instanceof Error ? cause.message : String(cause)}`,
      })
  );

/** Load and validate presets from the configured JSON or JSONC file. */
export const loadPresets = Effect.fn("Presets.load")(function* loadPresets() {
  const path = yield* resolvePath;

  return yield* readPresets(path);
}, presetError("load presets"));

/** Add or replace a saved preset. */
export const savePreset = Effect.fn("Presets.save")(function* savePreset(
  name: string,
  params: SearchParams
) {
  const path = yield* resolvePath;
  const current = yield* readPresets(path);
  const presets = [...current];
  const index = presets.findIndex((preset) => preset.name === name);

  if (index === -1) {
    presets.push({ name, params });
  } else {
    presets[index] = { name, params };
  }

  yield* writePresets(path, presets);
}, presetError("save preset"));

/** Delete a saved preset by name. */
export const deletePreset = Effect.fn("Presets.delete")(function* deletePreset(
  name: string
) {
  const path = yield* resolvePath;
  const current = yield* readPresets(path);
  yield* writePresets(
    path,
    current.filter((preset) => preset.name !== name)
  );
}, presetError("delete preset"));
