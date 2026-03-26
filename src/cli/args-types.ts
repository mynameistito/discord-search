import { z } from "zod";
import { SearchParamsSchema } from "@/discord/schemas.ts";

export const GlobalFlagsSchema = z.object({
  help: z.boolean(),
  version: z.boolean(),
  token: z.string().optional(),
});

export const InteractiveArgsSchema = GlobalFlagsSchema.extend({
  command: z.literal("interactive"),
  guild: z.string().optional(),
  clientId: z.string().optional(),
});

export const SearchArgsSchema = GlobalFlagsSchema.extend({
  command: z.literal("search"),
  params: SearchParamsSchema,
  export: z.string().optional(),
  outputDir: z.string().optional(),
  json: z.boolean(),
  savePreset: z.string().optional(),
});

export const PresetListArgsSchema = GlobalFlagsSchema.extend({
  command: z.literal("preset"),
  action: z.literal("list"),
});

export const PresetRunArgsSchema = GlobalFlagsSchema.extend({
  command: z.literal("preset"),
  action: z.literal("run"),
  name: z.string(),
  export: z.string().optional(),
  outputDir: z.string().optional(),
  json: z.boolean(),
});

export const PresetRunAllArgsSchema = GlobalFlagsSchema.extend({
  command: z.literal("preset"),
  action: z.literal("run-all"),
  names: z.array(z.string()),
  all: z.boolean(),
  export: z.string().optional(),
  outputDir: z.string().optional(),
  json: z.boolean(),
});

export const PresetSaveArgsSchema = GlobalFlagsSchema.extend({
  command: z.literal("preset"),
  action: z.literal("save"),
  name: z.string(),
  params: SearchParamsSchema,
});

export const PresetDeleteArgsSchema = GlobalFlagsSchema.extend({
  command: z.literal("preset"),
  action: z.literal("delete"),
  name: z.string(),
});

export const SettingsShowArgsSchema = GlobalFlagsSchema.extend({
  command: z.literal("settings"),
  action: z.literal("show"),
});

export const SettingsSetArgsSchema = GlobalFlagsSchema.extend({
  command: z.literal("settings"),
  action: z.literal("set"),
  key: z.string(),
  value: z.string(),
});

export const SettingsInviteArgsSchema = GlobalFlagsSchema.extend({
  command: z.literal("settings"),
  action: z.literal("invite"),
  clientId: z.string().optional(),
});

const PresetArgsSchema = z.discriminatedUnion("action", [
  PresetListArgsSchema,
  PresetRunArgsSchema,
  PresetRunAllArgsSchema,
  PresetSaveArgsSchema,
  PresetDeleteArgsSchema,
]);

const SettingsArgsSchema = z.discriminatedUnion("action", [
  SettingsShowArgsSchema,
  SettingsSetArgsSchema,
  SettingsInviteArgsSchema,
]);

export const ParsedArgsSchema = z.union([
  InteractiveArgsSchema,
  SearchArgsSchema,
  PresetArgsSchema,
  SettingsArgsSchema,
]);

export type GlobalFlags = z.infer<typeof GlobalFlagsSchema>;
export type InteractiveArgs = z.infer<typeof InteractiveArgsSchema>;
export type SearchArgs = z.infer<typeof SearchArgsSchema>;
export type PresetListArgs = z.infer<typeof PresetListArgsSchema>;
export type PresetRunArgs = z.infer<typeof PresetRunArgsSchema>;
export type PresetRunAllArgs = z.infer<typeof PresetRunAllArgsSchema>;
export type PresetSaveArgs = z.infer<typeof PresetSaveArgsSchema>;
export type PresetDeleteArgs = z.infer<typeof PresetDeleteArgsSchema>;
export type SettingsShowArgs = z.infer<typeof SettingsShowArgsSchema>;
export type SettingsSetArgs = z.infer<typeof SettingsSetArgsSchema>;
export type SettingsInviteArgs = z.infer<typeof SettingsInviteArgsSchema>;
export type ParsedArgs = z.infer<typeof ParsedArgsSchema>;
