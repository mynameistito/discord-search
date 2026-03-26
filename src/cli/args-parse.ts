import { exitWithError } from "@/cli/args-help.ts";
import {
  type GlobalFlags,
  type ParsedArgs,
  ParsedArgsSchema,
  type PresetRunAllArgs,
  type PresetRunArgs,
  type PresetSaveArgs,
  type SearchArgs,
} from "@/cli/args-types.ts";
import { parseCommaSeparated } from "@/cli/utils.ts";
import type { SearchParams } from "@/discord/schemas.ts";

// --- Arg parsing helpers ---

const consumeFlag = (
  args: string[],
  i: number,
  flagName: string
): { value: string; skip: number } => {
  const next = args[i + 1];
  if (next && !next.startsWith("-")) {
    return { value: next, skip: 1 };
  }
  return exitWithError(`Flag ${flagName} requires a value`);
};

const parseGlobalFlags = (
  args: string[]
): {
  global: GlobalFlags & { guild?: string; clientId?: string };
  remaining: string[];
} => {
  const global: GlobalFlags & { guild?: string; clientId?: string } = {
    help: false,
    version: false,
  };
  const remaining: string[] = [];

  for (let i = 0; i < args.length; i++) {
    const arg = args[i];

    if (arg === "--help" || arg === "-h") {
      global.help = true;
    } else if (arg === "--version" || arg === "-v") {
      global.version = true;
    } else if (arg === "--token" || arg === "-t") {
      const { value, skip } = consumeFlag(args, i, arg);
      global.token = value;
      i += skip;
    } else if (arg === "--guild" || arg === "-g") {
      const { value, skip } = consumeFlag(args, i, arg);
      global.guild = value;
      i += skip;
    } else if (arg === "--client-id" || arg === "-c") {
      const { value, skip } = consumeFlag(args, i, arg);
      global.clientId = value;
      i += skip;
    } else {
      remaining.push(arg ?? "");
    }
  }

  return { global, remaining };
};

// Maps flag names to SearchParams keys for comma-separated array fields
const COMMA_SEP_FLAGS: Record<string, keyof SearchParams> = {
  "--author-id": "authorId",
  "--author-type": "authorType",
  "--mentions": "mentions",
  "--mentions-role-id": "mentionsRoleId",
  "--channel-id": "channelId",
  "--has": "has",
  "--embed-type": "embedType",
  "--embed-provider": "embedProvider",
  "--link-hostname": "linkHostname",
  "--attachment-filename": "attachmentFilename",
  "--attachment-extension": "attachmentExtension",
  "--replied-to-user": "repliedToUserId",
  "--replied-to-message": "repliedToMessageId",
};

// Maps flag names to SearchParams keys for simple string fields
const STRING_FLAGS: Record<string, keyof SearchParams> = {
  "--content": "content",
  "--sort-by": "sortBy",
  "--sort-order": "sortOrder",
  "--min-id": "minId",
  "--max-id": "maxId",
};

// Maps flag names to SearchParams keys for boolean fields
const BOOLEAN_FLAGS: Record<string, keyof SearchParams> = {
  "--include-nsfw": "includeNsfw",
  "--pinned": "pinned",
  "--mention-everyone": "mentionEveryone",
};

const INTEGER_REGEX = /^\d+$/;

type SearchFlagsResult = {
  params: Omit<SearchParams, "guildId"> & { guildId?: string };
  export?: string;
  outputDir?: string;
  json: boolean;
  savePreset?: string;
};

/** True when the token looks like a value (not another flag). */
const isValue = (s: string | undefined): s is string =>
  s !== undefined && !s.startsWith("-");

/** Validate and return an integer value for a flag, or exit with error. */
const requireInt = (flag: string, next: string | undefined): number => {
  if (!isValue(next)) {
    return exitWithError(`Flag ${flag} requires a value`, "search");
  }
  if (!INTEGER_REGEX.test(next)) {
    return exitWithError(
      `Invalid value for ${flag}: expected integer, got "${next}"`,
      "search"
    );
  }
  return Number.parseInt(next, 10);
};

// Returns number of args consumed: 0 = no match, 1 = flag only, 2 = flag + value
const applySearchParamFlag = (
  arg: string,
  next: string | undefined,
  params: Record<string, unknown>
): number => {
  const commaSepKey = COMMA_SEP_FLAGS[arg];
  if (commaSepKey) {
    if (!isValue(next)) {
      return exitWithError(`Flag ${arg} requires a value`, "search");
    }
    params[commaSepKey] = parseCommaSeparated(next);
    return 2;
  }

  const stringKey = STRING_FLAGS[arg];
  if (stringKey) {
    if (!isValue(next)) {
      return exitWithError(`Flag ${arg} requires a value`, "search");
    }
    params[stringKey] = next;
    return 2;
  }

  const boolKey = BOOLEAN_FLAGS[arg];
  if (boolKey) {
    params[boolKey] = true;
    return 1;
  }

  if (arg === "--slop") {
    params.slop = requireInt("--slop", next);
    return 2;
  }

  if (arg === "--offset") {
    params.offset = requireInt("--offset", next);
    return 2;
  }

  if (arg === "--limit") {
    params.limit = requireInt("--limit", next);
    return 2;
  }

  return 0;
};

const VALID_EXPORT_FORMATS = new Set([
  "json",
  "csv-messages",
  "csv-embeds",
  "csv-fields",
  "all",
]);

// Parses common output flags (--export, --output-dir, --json) from args
const parseOutputFlags = (
  args: string[]
): { export?: string; outputDir?: string; json: boolean } => {
  let exportFormat: string | undefined;
  let outputDir: string | undefined;
  let json = false;

  for (let i = 0; i < args.length; i++) {
    const arg = args[i];
    const next = args[i + 1];
    if (arg === "--export") {
      if (!isValue(next)) {
        return exitWithError("Flag --export requires a value", "search");
      }
      if (!VALID_EXPORT_FORMATS.has(next)) {
        return exitWithError(
          `Invalid export format: "${next}". Valid formats: ${[...VALID_EXPORT_FORMATS].join(", ")}`,
          "search"
        );
      }
      exportFormat = next;
      i++;
    } else if (arg === "--output-dir") {
      if (!isValue(next)) {
        return exitWithError("Flag --output-dir requires a value", "search");
      }
      outputDir = next;
      i++;
    } else if (arg === "--json") {
      json = true;
    }
  }

  return { export: exportFormat, outputDir, json };
};

const parseSearchFlags = (
  args: string[],
  guildId?: string
): SearchFlagsResult => {
  const params: Record<string, unknown> = {};
  const output = parseOutputFlags(args);
  let savePreset: string | undefined;

  if (guildId) {
    params.guildId = guildId;
  }

  for (let i = 0; i < args.length; i++) {
    const arg = args[i] ?? "";
    const next = args[i + 1];

    const consumed = applySearchParamFlag(arg, next, params);
    if (consumed > 0) {
      i += consumed - 1;
      continue;
    }

    if (arg === "--save-preset") {
      if (!isValue(next)) {
        exitWithError("Flag --save-preset requires a value", "search");
      }
      savePreset = next;
      i++;
      continue;
    }

    // Skip flags already handled by parseOutputFlags
    if (arg === "--export" || arg === "--output-dir") {
      i++; // skip value
      continue;
    }
    if (arg === "--json") {
      continue;
    }

    if (arg.startsWith("-")) {
      exitWithError(`Unknown flag: "${arg}"`, "search");
    } else {
      exitWithError(
        `Unexpected positional argument: "${arg}". Did you mean --content "${arg}"?`,
        "search"
      );
    }
  }

  return {
    params: params as SearchFlagsResult["params"],
    export: output.export,
    outputDir: output.outputDir,
    json: output.json,
    savePreset,
  };
};

// --- Per-subcommand parsers ---

const parseSearchCommand = (
  remaining: string[],
  global: GlobalFlags & { guild?: string }
): SearchArgs => {
  const guildId = global.guild;
  if (!(global.help || guildId)) {
    return exitWithError(
      "Missing required --guild/-g (guildId) for search command",
      "search"
    );
  }

  // Short-circuit for help mode — SearchParamsSchema requires a valid guildId,
  // so we return directly without Zod validation when no guild is provided.
  if (global.help && !guildId) {
    return {
      command: "search",
      help: true,
      version: global.version,
      token: global.token,
      params: {} as SearchArgs["params"],
      json: false,
    } as SearchArgs;
  }

  const parsed = parseSearchFlags(remaining.slice(1), guildId);
  return ParsedArgsSchema.parse({
    command: "search",
    help: global.help,
    version: global.version,
    token: global.token,
    params: parsed.params,
    export: parsed.export,
    outputDir: parsed.outputDir,
    json: parsed.json,
    savePreset: parsed.savePreset,
  }) as SearchArgs;
};

const parsePresetRunAction = (
  remaining: string[],
  global: GlobalFlags
): PresetRunArgs => {
  const name = remaining[2];
  if (!name) {
    return exitWithError("preset name is required for 'preset run'", "preset");
  }
  const flags = parseOutputFlags(remaining.slice(3));
  return ParsedArgsSchema.parse({
    command: "preset",
    action: "run",
    name,
    ...flags,
    ...global,
  }) as PresetRunArgs;
};

const parsePresetRunAllAction = (
  remaining: string[],
  global: GlobalFlags
): PresetRunAllArgs => {
  const restArgs = remaining.slice(2);
  const names: string[] = [];
  let all = false;

  // Flags that consume the next argument as a value
  const valueFlagSet = new Set(["--export", "--output-dir"]);

  for (let i = 0; i < restArgs.length; i++) {
    const arg = restArgs[i] ?? "";

    if (arg === "--all") {
      all = true;
    } else if (arg === "--json") {
      // handled below via parseOutputFlags
    } else if (valueFlagSet.has(arg)) {
      i++; // skip the value argument so it isn't collected as a name
    } else if (!arg.startsWith("-")) {
      names.push(arg);
    }
  }

  const flags = parseOutputFlags(restArgs);

  if (!all && names.length === 0) {
    exitWithError("You must pass --all or at least one preset name", "preset");
  }

  return ParsedArgsSchema.parse({
    command: "preset",
    action: "run-all",
    names,
    all,
    export: flags.export,
    outputDir: flags.outputDir,
    json: flags.json,
    ...global,
  }) as PresetRunAllArgs;
};

const parsePresetSaveAction = (
  remaining: string[],
  global: GlobalFlags & { guild?: string }
): PresetSaveArgs => {
  const name = remaining[2];
  if (!name) {
    return exitWithError("preset name is required for 'preset save'", "preset");
  }
  if (!global.guild) {
    return exitWithError(
      "Missing required --guild/-g (guildId) for preset save",
      "preset"
    );
  }
  const parsed = parseSearchFlags(remaining.slice(3), global.guild);
  return ParsedArgsSchema.parse({
    command: "preset",
    action: "save",
    name,
    params: parsed.params,
    ...global,
  }) as PresetSaveArgs;
};

const parsePresetCommand = (
  remaining: string[],
  global: GlobalFlags & { guild?: string; clientId?: string }
): ParsedArgs => {
  if (global.help) {
    return ParsedArgsSchema.parse({
      command: "preset",
      action: "list",
      ...global,
    });
  }

  const action = remaining[1];

  if (action === "list") {
    return ParsedArgsSchema.parse({
      command: "preset",
      action: "list",
      ...global,
    });
  }

  if (action === "run") {
    return parsePresetRunAction(remaining, global);
  }

  if (action === "run-all") {
    return parsePresetRunAllAction(remaining, global);
  }

  if (action === "save") {
    return parsePresetSaveAction(remaining, global);
  }

  if (action === "delete") {
    const name = remaining[2];
    if (!name) {
      return exitWithError(
        "preset name is required for 'preset delete'",
        "preset"
      );
    }
    return ParsedArgsSchema.parse({
      command: "preset",
      action: "delete",
      name,
      ...global,
    });
  }

  return exitWithError(
    `Unknown preset action: ${action ?? "(none)"}. Use: list, run, run-all, save, delete`,
    "preset"
  );
};

const parseSettingsCommand = (
  remaining: string[],
  global: GlobalFlags & { clientId?: string }
): ParsedArgs => {
  if (global.help) {
    return ParsedArgsSchema.parse({
      command: "settings",
      action: "show",
      ...global,
    });
  }

  const action = remaining[1];

  if (action === "show") {
    return ParsedArgsSchema.parse({
      command: "settings",
      action: "show",
      ...global,
    });
  }

  if (action === "set") {
    const key = remaining[2];
    const value = remaining[3];
    if (!(key && value)) {
      return exitWithError(
        "key and value required. Usage: settings set <key> <value>",
        "settings"
      );
    }
    const VALID_SETTINGS_KEYS = new Set(["token", "client-id", "guild"]);
    if (!VALID_SETTINGS_KEYS.has(key)) {
      return exitWithError(
        `Unknown settings key: "${key}". Valid keys: ${[...VALID_SETTINGS_KEYS].join(", ")}`,
        "settings"
      );
    }
    return ParsedArgsSchema.parse({
      command: "settings",
      action: "set",
      key,
      value,
      ...global,
    });
  }

  if (action === "invite") {
    return ParsedArgsSchema.parse({
      command: "settings",
      action: "invite",
      clientId: global.clientId,
      ...global,
    });
  }

  return exitWithError(
    `Unknown settings action: ${action ?? "(none)"}. Use: show, set, invite`,
    "settings"
  );
};

// --- Main parser ---

export const parseArgs = (args: string[]): ParsedArgs => {
  const { global, remaining } = parseGlobalFlags(args);
  const subcommand = remaining[0];

  if (!subcommand) {
    return ParsedArgsSchema.parse({ command: "interactive", ...global });
  }

  if (subcommand === "search") {
    return parseSearchCommand(remaining, global);
  }

  if (subcommand === "preset") {
    return parsePresetCommand(remaining, global);
  }

  if (subcommand === "settings") {
    return parseSettingsCommand(remaining, global);
  }

  return exitWithError(
    `Unknown command: ${subcommand}. Available commands: search, preset, settings`
  );
};
