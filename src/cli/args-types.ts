import { Schema } from "effect";

import { SearchParamsSchema } from "@/discord/schemas.ts";

const EXPORT_FORMATS = [
  "json",
  "csv-messages",
  "csv-embeds",
  "csv-fields",
  "all",
] as const;

export const GlobalFlagsSchema = Schema.Struct({
  help: Schema.Boolean.pipe(Schema.mutableKey),
  token: Schema.String.pipe(Schema.optional, Schema.mutableKey),
  version: Schema.Boolean.pipe(Schema.mutableKey),
});

export const InteractiveArgsSchema = Schema.Struct({
  ...GlobalFlagsSchema.fields,
  clientId: Schema.String.pipe(Schema.optional),
  command: Schema.Literal("interactive"),
  guild: Schema.String.pipe(Schema.optional),
});

export const HelpArgsSchema = Schema.Struct({
  ...GlobalFlagsSchema.fields,
  command: Schema.Literal("help"),
  targetCommand: Schema.Literals(["search", "preset", "settings"]).pipe(
    Schema.optional
  ),
});

export const SearchArgsSchema = Schema.Struct({
  ...GlobalFlagsSchema.fields,
  command: Schema.Literal("search"),
  export: Schema.Literals(EXPORT_FORMATS).pipe(Schema.optional),
  json: Schema.Boolean,
  outputDir: Schema.String.pipe(Schema.optional),
  params: SearchParamsSchema,
  savePreset: Schema.String.pipe(Schema.optional),
});

export const PresetListArgsSchema = Schema.Struct({
  ...GlobalFlagsSchema.fields,
  action: Schema.Literal("list"),
  command: Schema.Literal("preset"),
});

export const PresetRunArgsSchema = Schema.Struct({
  ...GlobalFlagsSchema.fields,
  action: Schema.Literal("run"),
  command: Schema.Literal("preset"),
  export: Schema.Literals(EXPORT_FORMATS).pipe(Schema.optional),
  json: Schema.Boolean,
  name: Schema.String,
  outputDir: Schema.String.pipe(Schema.optional),
});

export const PresetRunAllArgsSchema = Schema.Struct({
  ...GlobalFlagsSchema.fields,
  action: Schema.Literal("run-all"),
  all: Schema.Boolean,
  command: Schema.Literal("preset"),
  export: Schema.Literals(EXPORT_FORMATS).pipe(Schema.optional),
  names: Schema.Array(Schema.String),
  outputDir: Schema.String.pipe(Schema.optional),
});

export const PresetSaveArgsSchema = Schema.Struct({
  ...GlobalFlagsSchema.fields,
  action: Schema.Literal("save"),
  command: Schema.Literal("preset"),
  name: Schema.String,
  params: SearchParamsSchema,
});

export const PresetDeleteArgsSchema = Schema.Struct({
  ...GlobalFlagsSchema.fields,
  action: Schema.Literal("delete"),
  command: Schema.Literal("preset"),
  name: Schema.String,
});

export const SettingsShowArgsSchema = Schema.Struct({
  ...GlobalFlagsSchema.fields,
  action: Schema.Literal("show"),
  command: Schema.Literal("settings"),
});

export const SettingsSetArgsSchema = Schema.Struct({
  ...GlobalFlagsSchema.fields,
  action: Schema.Literal("set"),
  command: Schema.Literal("settings"),
  key: Schema.Literals(["token", "client-id", "guild"]),
  value: Schema.String,
});

export const SettingsInviteArgsSchema = Schema.Struct({
  ...GlobalFlagsSchema.fields,
  action: Schema.Literal("invite"),
  clientId: Schema.String.pipe(Schema.optional),
  command: Schema.Literal("settings"),
});

export const PresetArgsSchema = Schema.Union([
  PresetListArgsSchema,
  PresetRunArgsSchema,
  PresetRunAllArgsSchema,
  PresetSaveArgsSchema,
  PresetDeleteArgsSchema,
]);

export const SettingsArgsSchema = Schema.Union([
  SettingsShowArgsSchema,
  SettingsSetArgsSchema,
  SettingsInviteArgsSchema,
]);

export const ParsedArgsSchema = Schema.Union([
  InteractiveArgsSchema,
  HelpArgsSchema,
  SearchArgsSchema,
  PresetArgsSchema,
  SettingsArgsSchema,
]);

/** Global options accepted by CLI commands. */
export type GlobalFlags = typeof GlobalFlagsSchema.Type;

/** Arguments for launching the interactive interface. */
export type InteractiveArgs = typeof InteractiveArgsSchema.Type;

/** Arguments for displaying general or subcommand help. */
export type HelpArgs = typeof HelpArgsSchema.Type;

/** Arguments for a message search command. */
export type SearchArgs = typeof SearchArgsSchema.Type;

/** Arguments for listing saved presets. */
export type PresetListArgs = typeof PresetListArgsSchema.Type;

/** Arguments for running one saved preset. */
export type PresetRunArgs = typeof PresetRunArgsSchema.Type;

/** Arguments for running multiple saved presets. */
export type PresetRunAllArgs = typeof PresetRunAllArgsSchema.Type;

/** Arguments for saving a new preset. */
export type PresetSaveArgs = typeof PresetSaveArgsSchema.Type;

/** Arguments for deleting a saved preset. */
export type PresetDeleteArgs = typeof PresetDeleteArgsSchema.Type;

/** Arguments for displaying settings. */
export type SettingsShowArgs = typeof SettingsShowArgsSchema.Type;

/** Arguments for updating a setting. */
export type SettingsSetArgs = typeof SettingsSetArgsSchema.Type;

/** Arguments for generating a bot invite URL. */
export type SettingsInviteArgs = typeof SettingsInviteArgsSchema.Type;

/** Any valid parsed CLI command. */
export type ParsedArgs = typeof ParsedArgsSchema.Type;
