import { z } from "zod";

import { SearchParamsSchema } from "@/discord/schemas.ts";

const EXPORT_FORMATS = [
  "json",
  "csv-messages",
  "csv-embeds",
  "csv-fields",
  "all",
] as const;

export const GlobalFlagsSchema = z.object({
  help: z.boolean(),
  token: z.string().optional(),
  version: z.boolean(),
});

export const InteractiveArgsSchema = GlobalFlagsSchema.extend({
  clientId: z.string().optional(),
  command: z.literal("interactive"),
  guild: z.string().optional(),
});

export const HelpArgsSchema = GlobalFlagsSchema.extend({
  command: z.literal("help"),
  targetCommand: z.enum(["search", "preset", "settings"]).optional(),
});

export const SearchArgsSchema = GlobalFlagsSchema.extend({
  command: z.literal("search"),
  export: z.enum(EXPORT_FORMATS).optional(),
  json: z.boolean(),
  outputDir: z.string().optional(),
  params: SearchParamsSchema,
  savePreset: z.string().optional(),
});

export const PresetListArgsSchema = GlobalFlagsSchema.extend({
  action: z.literal("list"),
  command: z.literal("preset"),
});

export const PresetRunArgsSchema = GlobalFlagsSchema.extend({
  action: z.literal("run"),
  command: z.literal("preset"),
  export: z.enum(EXPORT_FORMATS).optional(),
  json: z.boolean(),
  name: z.string(),
  outputDir: z.string().optional(),
});

export const PresetRunAllArgsSchema = GlobalFlagsSchema.extend({
  action: z.literal("run-all"),
  all: z.boolean(),
  command: z.literal("preset"),
  export: z.enum(EXPORT_FORMATS).optional(),
  names: z.array(z.string()),
  outputDir: z.string().optional(),
});

export const PresetSaveArgsSchema = GlobalFlagsSchema.extend({
  action: z.literal("save"),
  command: z.literal("preset"),
  name: z.string(),
  params: SearchParamsSchema,
});

export const PresetDeleteArgsSchema = GlobalFlagsSchema.extend({
  action: z.literal("delete"),
  command: z.literal("preset"),
  name: z.string(),
});

export const SettingsShowArgsSchema = GlobalFlagsSchema.extend({
  action: z.literal("show"),
  command: z.literal("settings"),
});

export const SettingsSetArgsSchema = GlobalFlagsSchema.extend({
  action: z.literal("set"),
  command: z.literal("settings"),
  key: z.enum(["token", "client-id", "guild"]),
  value: z.string(),
});

export const SettingsInviteArgsSchema = GlobalFlagsSchema.extend({
  action: z.literal("invite"),
  clientId: z.string().optional(),
  command: z.literal("settings"),
});

export const PresetArgsSchema = z.discriminatedUnion("action", [
  PresetListArgsSchema,
  PresetRunArgsSchema,
  PresetRunAllArgsSchema,
  PresetSaveArgsSchema,
  PresetDeleteArgsSchema,
]);

export const SettingsArgsSchema = z.discriminatedUnion("action", [
  SettingsShowArgsSchema,
  SettingsSetArgsSchema,
  SettingsInviteArgsSchema,
]);

export const ParsedArgsSchema = z.union([
  InteractiveArgsSchema,
  HelpArgsSchema,
  SearchArgsSchema,
  PresetArgsSchema,
  SettingsArgsSchema,
]);

/** Global options accepted by CLI commands. */
export type GlobalFlags = z.infer<typeof GlobalFlagsSchema>;

/** Arguments for launching the interactive interface. */
export type InteractiveArgs = z.infer<typeof InteractiveArgsSchema>;

/** Arguments for displaying general or subcommand help. */
export type HelpArgs = z.infer<typeof HelpArgsSchema>;

/** Arguments for a message search command. */
export type SearchArgs = z.infer<typeof SearchArgsSchema>;

/** Arguments for listing saved presets. */
export type PresetListArgs = z.infer<typeof PresetListArgsSchema>;

/** Arguments for running one saved preset. */
export type PresetRunArgs = z.infer<typeof PresetRunArgsSchema>;

/** Arguments for running multiple saved presets. */
export type PresetRunAllArgs = z.infer<typeof PresetRunAllArgsSchema>;

/** Arguments for saving a new preset. */
export type PresetSaveArgs = z.infer<typeof PresetSaveArgsSchema>;

/** Arguments for deleting a saved preset. */
export type PresetDeleteArgs = z.infer<typeof PresetDeleteArgsSchema>;

/** Arguments for displaying settings. */
export type SettingsShowArgs = z.infer<typeof SettingsShowArgsSchema>;

/** Arguments for updating a setting. */
export type SettingsSetArgs = z.infer<typeof SettingsSetArgsSchema>;

/** Arguments for generating a bot invite URL. */
export type SettingsInviteArgs = z.infer<typeof SettingsInviteArgsSchema>;

/** Any valid parsed CLI command. */
export type ParsedArgs = z.infer<typeof ParsedArgsSchema>;
