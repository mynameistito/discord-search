import { z } from "zod";

import { exitWithError } from "@/cli/args-help.ts";
import { ParsedArgsSchema } from "@/cli/args-types.ts";
import type {
  GlobalFlags,
  HelpArgs,
  ParsedArgs,
  PresetRunAllArgs,
  PresetRunArgs,
  PresetSaveArgs,
  SearchArgs,
} from "@/cli/args-types.ts";
import { INTEGER_REGEX, parseCommaSeparated } from "@/cli/utils.ts";
import { SNOWFLAKE_REGEX } from "@/discord/schemas.ts";
import type { SearchParams } from "@/discord/schemas.ts";

const parseWithError = <T extends ParsedArgs>(
  data: T,
  subcommand: string
): T => {
  const result = ParsedArgsSchema.safeParse(data);

  if (!result.success) {
    const messages = result.error.issues.map((i) => i.message);
    exitWithError(messages.join("; "), subcommand);
  }

  return data;
};

// --- Arg parsing helpers ---

const consumeFlag = (
  args: string[],
  i: number,
  flagName: string
): ConsumedFlag => {
  const next = args[i + 1];

  if (next !== undefined && next.length > 0 && !next.startsWith("-")) {
    return { skip: 1, value: next };
  }

  return exitWithError(`Flag ${flagName} requires a value`);
};

interface ConsumedFlag {
  value: string;
  skip: number;
}

const parseGlobalFlags = (args: string[]): ParsedGlobalFlags => {
  const global: GlobalFlags & { guild?: string; clientId?: string } = {
    help: false,
    version: false,
  };

  const remaining: string[] = [];

  for (let i = 0; i < args.length; i += 1) {
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

interface ParsedGlobalFlags {
  global: GlobalFlags & { guild?: string; clientId?: string };
  remaining: string[];
}

type FlagKeyMap = Readonly<Record<string, keyof SearchParams | undefined>>;

// Maps flag names to SearchParams keys for comma-separated array fields
const COMMA_SEP_FLAGS = {
  "--attachment-extension": "attachmentExtension",
  "--attachment-filename": "attachmentFilename",
  "--author-id": "authorId",
  "--author-type": "authorType",
  "--channel-id": "channelId",
  "--embed-provider": "embedProvider",
  "--embed-type": "embedType",
  "--has": "has",
  "--link-hostname": "linkHostname",
  "--mentions": "mentions",
  "--mentions-role-id": "mentionsRoleId",
  "--replied-to-message": "repliedToMessageId",
  "--replied-to-user": "repliedToUserId",
} satisfies FlagKeyMap;

// Maps flag names to SearchParams keys for simple string fields
const STRING_FLAGS = {
  "--content": "content",
  "--max-id": "maxId",
  "--min-id": "minId",
  "--sort-by": "sortBy",
  "--sort-order": "sortOrder",
} satisfies FlagKeyMap;

// Maps flag names to SearchParams keys for boolean fields
const BOOLEAN_FLAGS = {
  "--include-nsfw": "includeNsfw",
  "--mention-everyone": "mentionEveryone",
  "--pinned": "pinned",
} satisfies FlagKeyMap;

const getFlagKey = (
  flags: FlagKeyMap,
  arg: string
): keyof SearchParams | undefined =>
  Object.entries(flags).find(([flag]) => flag === arg)?.[1];

interface SearchFlagsResult {
  params: SearchParamsInput;
  export?: ExportFormat;
  outputDir?: string;
  json: boolean;
  savePreset?: string;
}

type SearchParamsInput = Partial<SearchParams> & { guildId?: string };

type ParseContext = "search" | "preset";

/** Check whether an argument can be used as a flag value.
 *
 * @param s - The candidate argument.
 * @returns Whether the argument is a non-empty value rather than another flag.
 */
const isValue = (s: string | undefined): s is string =>
  s !== undefined && !s.startsWith("-");

/** Validate and return an integer value for a flag, or exit with error.
 *
 * @param flag - The option name being parsed.
 * @param next - The following CLI argument.
 * @param context - The command used to format parsing errors.
 * @returns The parsed integer.
 */
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

  return Math.trunc(Number(next));
};

// Returns number of args consumed: 0 = no match, 1 = flag only, 2 = flag + value
const applySearchParamFlag = (
  arg: string,
  next: string | undefined,
  params: SearchParamsInput,
  context: ParseContext
): number => {
  const commaSepKey = getFlagKey(COMMA_SEP_FLAGS, arg);

  if (commaSepKey !== undefined) {
    if (!isValue(next)) {
      return exitWithError(`Flag ${arg} requires a value`, context);
    }

    Object.assign(params, { [commaSepKey]: parseCommaSeparated(next) });

    return 2;
  }

  const stringKey = getFlagKey(STRING_FLAGS, arg);

  if (stringKey !== undefined) {
    if (!isValue(next)) {
      return exitWithError(`Flag ${arg} requires a value`, context);
    }

    Object.assign(params, { [stringKey]: next });

    return 2;
  }

  const boolKey = getFlagKey(BOOLEAN_FLAGS, arg);

  if (boolKey !== undefined) {
    Object.assign(params, { [boolKey]: true });

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

const VALID_EXPORT_FORMATS = [
  "json",
  "csv-messages",
  "csv-embeds",
  "csv-fields",
  "all",
] as const;

type ExportFormat = (typeof VALID_EXPORT_FORMATS)[number];

const VALID_EXPORT_FORMAT_SET = new Set<string>(VALID_EXPORT_FORMATS);
const PRESET_RUN_ALL_COMMAND = "preset run-all";

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
): ParseOutputFlagsResult => {
  let exportFormat: ExportFormat | undefined;
  let outputDir: string | undefined;
  let json = false;
  const leftovers: string[] = [];

  for (let i = 0; i < args.length; i += 1) {
    const arg = args[i];
    const next = args[i + 1];

    if (arg === "--export") {
      if (!isValue(next)) {
        return exitWithError("Flag --export requires a value", subcommand);
      }

      if (!VALID_EXPORT_FORMAT_SET.has(next)) {
        return exitWithError(
          `Invalid export format: "${next}". Valid formats: ${[...VALID_EXPORT_FORMATS].join(", ")}`,
          subcommand
        );
      }

      exportFormat = VALID_EXPORT_FORMATS.find((format) => format === next);
      i += 1;
    } else if (arg === "--output-dir") {
      if (!isValue(next)) {
        return exitWithError("Flag --output-dir requires a value", subcommand);
      }

      outputDir = next;
      i += 1;
    } else if (arg === "--json") {
      json = true;
    } else if (arg !== undefined) {
      leftovers.push(arg);
    }
  }

  return { export: exportFormat, json, leftovers, outputDir };
};

interface ParseOutputFlagsResult {
  export?: ExportFormat;
  outputDir?: string;
  json: boolean;
  leftovers: string[];
}

const parseSearchFlags = (
  args: string[],
  guildId?: string,
  context: ParseContext = "search"
): SearchFlagsResult => {
  const params: SearchParamsInput = {};
  const output = parseOutputFlags(args, context);
  let savePreset: string | undefined;

  if (guildId !== undefined) {
    params.guildId = guildId;
  }

  for (let i = 0; i < output.leftovers.length; i += 1) {
    const arg = output.leftovers[i] ?? "";
    const next = output.leftovers[i + 1];

    const consumed = applySearchParamFlag(arg, next, params, context);

    if (consumed > 0) {
      i += consumed - 1;
    } else if (arg === "--save-preset") {
      if (!isValue(next)) {
        exitWithError("Flag --save-preset requires a value", context);
      }

      savePreset = next;
      i += 1;
    } else if (arg.startsWith("-")) {
      exitWithError(`Unknown flag: "${arg}"`, context);
    } else {
      exitWithError(
        `Unexpected positional argument: "${arg}". Did you mean --content "${arg}"?`,
        context
      );
    }
  }

  return {
    export: output.export,
    json: output.json,
    outputDir: output.outputDir,
    params,
    savePreset,
  };
};

// --- Per-subcommand parsers ---

const parseSearchCommand = (
  remaining: string[],
  global: GlobalFlags & { guild?: string }
): SearchArgs | HelpArgs => {
  const guildId = global.guild;

  if (global.help) {
    return parseWithError<HelpArgs>(
      {
        command: "help",
        help: true,
        targetCommand: "search",
        token: global.token,
        version: global.version,
      },
      "search"
    );
  }

  if (global.version) {
    return parseWithError<HelpArgs>(
      {
        command: "help",
        help: global.help,
        targetCommand: "search",
        token: global.token,
        version: true,
      },
      "search"
    );
  }

  if (guildId === undefined || guildId.length === 0) {
    return exitWithError(
      "Missing required --guild/-g (guildId) for search command",
      "search"
    );
  }

  const parsed = parseSearchFlags(remaining.slice(1), guildId, "search");

  return parseWithError<SearchArgs>(
    {
      command: "search",
      export: parsed.export,
      help: global.help,
      json: parsed.json,
      outputDir: parsed.outputDir,
      params: { ...parsed.params, guildId },
      savePreset: parsed.savePreset,
      token: global.token,
      version: global.version,
    },
    "search"
  );
};

const parsePresetRunAction = (
  remaining: string[],
  global: GlobalFlags
): PresetRunArgs => {
  const name = remaining.slice(2).at(0);

  if (name === undefined || name.length === 0 || name.startsWith("-")) {
    return exitWithError("preset name is required for 'preset run'", "preset");
  }

  const flags = parseOutputFlags(remaining.slice(3), "preset");
  checkNoLeftovers(flags.leftovers, "preset run");

  return parseWithError<PresetRunArgs>(
    {
      action: "run",
      command: "preset",
      export: flags.export,
      help: global.help,
      json: flags.json,
      name,
      outputDir: flags.outputDir,
      token: global.token,
      version: global.version,
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

  if (flags.json) {
    exitWithError(
      "--json is not supported for 'preset run-all'. Use --export to export results.",
      PRESET_RUN_ALL_COMMAND
    );
  }

  const names: string[] = [];
  let all = false;

  for (const arg of flags.leftovers) {
    if (arg === "--all") {
      all = true;
    } else if (arg.startsWith("-")) {
      exitWithError(`Unknown flag: "${arg}"`, PRESET_RUN_ALL_COMMAND);
    } else {
      names.push(arg);
    }
  }

  if (all && names.length > 0) {
    exitWithError(
      "Cannot specify both --all and named presets",
      PRESET_RUN_ALL_COMMAND
    );
  }

  if (!all && names.length === 0) {
    exitWithError("You must pass --all or at least one preset name", "preset");
  }

  return parseWithError<PresetRunAllArgs>(
    {
      action: "run-all",
      all,
      command: "preset",
      export: flags.export,
      help: global.help,
      names,
      outputDir: flags.outputDir,
      token: global.token,
      version: global.version,
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
  const name = remaining.slice(2).at(0);

  if (name === undefined || name.length === 0 || name.startsWith("-")) {
    return exitWithError("preset name is required for 'preset save'", "preset");
  }

  if (global.guild === undefined || global.guild.length === 0) {
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
      action: "save",
      command: "preset",
      help: global.help,
      name,
      params: { ...parsed.params, guildId: global.guild },
      token: global.token,
      version: global.version,
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
        help: true,
        targetCommand: "preset",
        token: global.token,
        version: global.version,
      },
      "preset"
    );
  }

  if (global.version) {
    return parseWithError<ParsedArgs>(
      {
        action: "list",
        command: "preset",
        help: global.help,
        token: global.token,
        version: true,
      },
      "preset"
    );
  }

  const action = remaining.slice(1).at(0);

  if (action === "list") {
    checkNoLeftovers(remaining.slice(2), "preset list");

    return parseWithError<ParsedArgs>(
      {
        action: "list",
        command: "preset",
        help: global.help,
        token: global.token,
        version: global.version,
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
    const name = remaining.slice(2).at(0);

    if (name === undefined || name.length === 0 || name.startsWith("-")) {
      return exitWithError(
        "preset name is required for 'preset delete'",
        "preset"
      );
    }

    checkNoLeftovers(remaining.slice(3), "preset delete");

    return parseWithError<ParsedArgs>(
      {
        action: "delete",
        command: "preset",
        help: global.help,
        name,
        token: global.token,
        version: global.version,
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
        help: true,
        targetCommand: "settings",
        token: global.token,
        version: global.version,
      },
      "settings"
    );
  }

  if (global.version) {
    return parseWithError<ParsedArgs>(
      {
        action: "show",
        command: "settings",
        help: global.help,
        token: global.token,
        version: true,
      },
      "settings"
    );
  }

  const action = remaining.slice(1).at(0);

  if (action === "show") {
    checkNoLeftovers(remaining.slice(2), "settings show");

    return parseWithError<ParsedArgs>(
      {
        action: "show",
        command: "settings",
        help: global.help,
        token: global.token,
        version: global.version,
      },
      "settings"
    );
  }

  if (action === "set") {
    const [key, value] = remaining.slice(2);

    if (
      key === undefined ||
      key.length === 0 ||
      value === undefined ||
      value.length === 0
    ) {
      return exitWithError(
        "key and value required. Usage: settings set <key> <value>",
        "settings"
      );
    }

    const settingsKeySchema = z.enum(["token", "client-id", "guild"]);
    const parsedKey = settingsKeySchema.safeParse(key);

    if (!parsedKey.success) {
      return exitWithError(
        `Unknown settings key: "${key}". Valid keys: token, client-id, guild`,
        "settings"
      );
    }

    const settingKey = parsedKey.data;

    if (
      (settingKey === "guild" || settingKey === "client-id") &&
      !SNOWFLAKE_REGEX.test(value)
    ) {
      return exitWithError(
        `Invalid value for ${settingKey}: must be a 17-20 digit snowflake ID`,
        "settings set"
      );
    }

    checkNoLeftovers(remaining.slice(4), "settings set");

    return parseWithError<ParsedArgs>(
      {
        action: "set",
        command: "settings",
        help: global.help,
        key: settingKey,
        token: global.token,
        value,
        version: global.version,
      },
      "settings"
    );
  }

  if (action === "invite") {
    checkNoLeftovers(remaining.slice(2), "settings invite");

    return parseWithError<ParsedArgs>(
      {
        action: "invite",
        command: "settings",
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

/** Parse and validate command-line arguments.
 *
 * @param args - Command-line arguments, excluding the executable and script.
 * @returns The parsed CLI command.
 */
export const parseArgs = (args: string[]): ParsedArgs => {
  const { global, remaining } = parseGlobalFlags(args);
  const [subcommand] = remaining;

  if (subcommand === undefined || subcommand.length === 0) {
    if (global.help) {
      return parseWithError<ParsedArgs>(
        { command: "help", ...global },
        "interactive"
      );
    }

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
