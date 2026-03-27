import { exitWithError } from "@/cli/args-help.ts";
import {
  type GlobalFlags,
  type HelpArgs,
  type ParsedArgs,
  ParsedArgsSchema,
  type PresetRunAllArgs,
  type PresetRunArgs,
  type PresetSaveArgs,
  type SearchArgs,
} from "@/cli/args-types.ts";
import { parseCommaSeparated } from "@/cli/utils.ts";
import type { SearchParams } from "@/discord/schemas.ts";

const parseWithError = <T>(data: unknown, subcommand: string): T => {
  const result = ParsedArgsSchema.safeParse(data);
  if (!result.success) {
    const messages = result.error.issues.map((i) => i.message);
    exitWithError(messages.join("; "), subcommand);
  }
  return result.data as T;
};

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

type ParseContext = "search" | "preset";

/** True when the token looks like a value (not another flag). */
const isValue = (s: string | undefined): s is string =>
  s !== undefined && !s.startsWith("-");

/** Validate and return an integer value for a flag, or exit with error. */
const requireInt = (
  flag: string,
  next: string | undefined,
  context: ParseContext
): number => {
  if (!isValue(next)) {
    return exitWithError(`Flag ${flag} requires a value`, context);
  }
  if (!INTEGER_REGEX.test(next)) {
    return exitWithError(
      `Invalid value for ${flag}: expected integer, got "${next}"`,
      context
    );
  }
  return Number.parseInt(next, 10);
};

// Returns number of args consumed: 0 = no match, 1 = flag only, 2 = flag + value
const applySearchParamFlag = (
  arg: string,
  next: string | undefined,
  params: Record<string, unknown>,
  context: ParseContext
): number => {
  const commaSepKey = COMMA_SEP_FLAGS[arg];
  if (commaSepKey) {
    if (!isValue(next)) {
      return exitWithError(`Flag ${arg} requires a value`, context);
    }
    params[commaSepKey] = parseCommaSeparated(next);
    return 2;
  }

  const stringKey = STRING_FLAGS[arg];
  if (stringKey) {
    if (!isValue(next)) {
      return exitWithError(`Flag ${arg} requires a value`, context);
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
    params.slop = requireInt("--slop", next, context);
    return 2;
  }

  if (arg === "--offset") {
    params.offset = requireInt("--offset", next, context);
    return 2;
  }

  if (arg === "--limit") {
    params.limit = requireInt("--limit", next, context);
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

const checkNoLeftovers = (args: string[], command: string): void => {
  for (const arg of args) {
    if (arg.startsWith("-")) {
      exitWithError(`Unknown flag: "${arg}"`, command);
    } else {
      exitWithError(`Unexpected positional argument: "${arg}"`, command);
    }
  }
};

// Parses common output flags (--export, --output-dir, --json) from args
// Returns flags and leftover args that weren't recognized
const parseOutputFlags = (
  args: string[],
  subcommand: "search" | "preset"
): {
  export?: string;
  outputDir?: string;
  json: boolean;
  leftovers: string[];
} => {
  let exportFormat: string | undefined;
  let outputDir: string | undefined;
  let json = false;
  const leftovers: string[] = [];

  for (let i = 0; i < args.length; i++) {
    const arg = args[i];
    const next = args[i + 1];
    if (arg === "--export") {
      if (!isValue(next)) {
        return exitWithError("Flag --export requires a value", subcommand);
      }
      if (!VALID_EXPORT_FORMATS.has(next)) {
        return exitWithError(
          `Invalid export format: "${next}". Valid formats: ${[...VALID_EXPORT_FORMATS].join(", ")}`,
          subcommand
        );
      }
      exportFormat = next;
      i++;
    } else if (arg === "--output-dir") {
      if (!isValue(next)) {
        return exitWithError("Flag --output-dir requires a value", subcommand);
      }
      outputDir = next;
      i++;
    } else if (arg === "--json") {
      json = true;
    } else if (arg !== undefined) {
      leftovers.push(arg);
    }
  }

  return { export: exportFormat, outputDir, json, leftovers };
};

const parseSearchFlags = (
  args: string[],
  guildId?: string,
  context: ParseContext = "search"
): SearchFlagsResult => {
  const params: Record<string, unknown> = {};
  const output = parseOutputFlags(args, context);
  let savePreset: string | undefined;

  if (guildId) {
    params.guildId = guildId;
  }

  for (let i = 0; i < output.leftovers.length; i++) {
    const arg = output.leftovers[i] ?? "";
    const next = output.leftovers[i + 1];

    const consumed = applySearchParamFlag(arg, next, params, context);
    if (consumed > 0) {
      i += consumed - 1;
      continue;
    }

    if (arg === "--save-preset") {
      if (!isValue(next)) {
        exitWithError("Flag --save-preset requires a value", context);
      }
      savePreset = next;
      i++;
      continue;
    }

    if (arg.startsWith("-")) {
      exitWithError(`Unknown flag: "${arg}"`, context);
    } else {
      exitWithError(
        `Unexpected positional argument: "${arg}". Did you mean --content "${arg}"?`,
        context
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
): SearchArgs | HelpArgs => {
  const guildId = global.guild;
  if (!(global.help || guildId)) {
    return exitWithError(
      "Missing required --guild/-g (guildId) for search command",
      "search"
    );
  }

  if (global.help && !guildId) {
    return parseWithError<HelpArgs>(
      {
        command: "help",
        targetCommand: "search",
        help: true,
        version: global.version,
        token: global.token,
      },
      "search"
    );
  }

  const parsed = parseSearchFlags(remaining.slice(1), guildId, "search");
  return parseWithError<SearchArgs>(
    {
      command: "search",
      help: global.help,
      version: global.version,
      token: global.token,
      params: parsed.params,
      export: parsed.export,
      outputDir: parsed.outputDir,
      json: parsed.json,
      savePreset: parsed.savePreset,
    },
    "search"
  );
};

const parsePresetRunAction = (
  remaining: string[],
  global: GlobalFlags
): PresetRunArgs => {
  const name = remaining[2];
  if (!name || name.startsWith("-")) {
    return exitWithError("preset name is required for 'preset run'", "preset");
  }
  const flags = parseOutputFlags(remaining.slice(3), "preset");
  checkNoLeftovers(flags.leftovers, "preset run");
  return parseWithError<PresetRunArgs>(
    {
      command: "preset",
      action: "run",
      name,
      export: flags.export,
      outputDir: flags.outputDir,
      json: flags.json,
      help: global.help,
      version: global.version,
      token: global.token,
    },
    "preset"
  );
};

const parsePresetRunAllAction = (
  remaining: string[],
  global: GlobalFlags
): PresetRunAllArgs => {
  const restArgs = remaining.slice(2);
  const flags = parseOutputFlags(restArgs, "preset");
  const names: string[] = [];
  let all = false;

  for (const arg of flags.leftovers) {
    if (arg === "--all") {
      all = true;
    } else if (arg.startsWith("-")) {
      exitWithError(`Unknown flag: "${arg}"`, "preset run-all");
    } else {
      names.push(arg);
    }
  }

  if (!all && names.length === 0) {
    exitWithError("You must pass --all or at least one preset name", "preset");
  }

  return parseWithError<PresetRunAllArgs>(
    {
      command: "preset",
      action: "run-all",
      names,
      all,
      export: flags.export,
      outputDir: flags.outputDir,
      json: flags.json,
      help: global.help,
      version: global.version,
      token: global.token,
    },
    "preset"
  );
};

const DISALLOWED_PRESET_SAVE_FLAGS = new Set([
  "--export",
  "--output-dir",
  "--json",
  "--save-preset",
]);

const parsePresetSaveAction = (
  remaining: string[],
  global: GlobalFlags & { guild?: string }
): PresetSaveArgs => {
  const name = remaining[2];
  if (!name || name.startsWith("-")) {
    return exitWithError("preset name is required for 'preset save'", "preset");
  }
  if (!global.guild) {
    return exitWithError(
      "Missing required --guild/-g (guildId) for preset save",
      "preset"
    );
  }
  const restArgs = remaining.slice(3);
  for (const arg of restArgs) {
    if (DISALLOWED_PRESET_SAVE_FLAGS.has(arg)) {
      return exitWithError(
        `Flag ${arg} is not valid for 'preset save'. Only search parameter flags are allowed.`,
        "preset"
      );
    }
  }
  const parsed = parseSearchFlags(restArgs, global.guild, "preset");
  return parseWithError<PresetSaveArgs>(
    {
      command: "preset",
      action: "save",
      name,
      params: parsed.params,
      help: global.help,
      version: global.version,
      token: global.token,
    },
    "preset"
  );
};

const parsePresetCommand = (
  remaining: string[],
  global: GlobalFlags & { guild?: string; clientId?: string }
): ParsedArgs => {
  if (global.help) {
    return parseWithError<HelpArgs>(
      {
        command: "help",
        targetCommand: "preset",
        help: true,
        version: global.version,
        token: global.token,
      },
      "preset"
    );
  }

  const action = remaining[1];

  if (action === "list") {
    checkNoLeftovers(remaining.slice(2), "preset list");
    return parseWithError<ParsedArgs>(
      {
        command: "preset",
        action: "list",
        help: global.help,
        version: global.version,
        token: global.token,
      },
      "preset"
    );
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
    if (!name || name.startsWith("-")) {
      return exitWithError(
        "preset name is required for 'preset delete'",
        "preset"
      );
    }
    checkNoLeftovers(remaining.slice(3), "preset delete");
    return parseWithError<ParsedArgs>(
      {
        command: "preset",
        action: "delete",
        name,
        help: global.help,
        version: global.version,
        token: global.token,
      },
      "preset"
    );
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
    return parseWithError<HelpArgs>(
      {
        command: "help",
        targetCommand: "settings",
        help: true,
        version: global.version,
        token: global.token,
      },
      "settings"
    );
  }

  const action = remaining[1];

  if (action === "show") {
    checkNoLeftovers(remaining.slice(2), "settings show");
    return parseWithError<ParsedArgs>(
      {
        command: "settings",
        action: "show",
        help: global.help,
        version: global.version,
        token: global.token,
      },
      "settings"
    );
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
    checkNoLeftovers(remaining.slice(4), "settings set");
    return parseWithError<ParsedArgs>(
      {
        command: "settings",
        action: "set",
        key,
        value,
        help: global.help,
        version: global.version,
        token: global.token,
      },
      "settings"
    );
  }

  if (action === "invite") {
    checkNoLeftovers(remaining.slice(2), "settings invite");
    return parseWithError<ParsedArgs>(
      {
        command: "settings",
        action: "invite",
        ...global,
      },
      "settings"
    );
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
    return parseWithError<ParsedArgs>(
      { command: "interactive", ...global },
      "interactive"
    );
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
