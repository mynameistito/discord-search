import {
  ANSI_BOLD,
  ANSI_CYAN,
  ANSI_DIM,
  ANSI_GREEN,
  ANSI_RED,
  ANSI_RESET,
  ANSI_YELLOW,
} from "@/cli/ansi.ts";

const heading = (text: string): string =>
  `${ANSI_CYAN}${ANSI_BOLD}${text}${ANSI_RESET}`;

const opt = (flags: string, desc: string, width = 34): string =>
  `  ${ANSI_YELLOW}${flags.padEnd(width)}${ANSI_RESET}${ANSI_DIM}${desc}${ANSI_RESET}`;

const example = (cmd: string, desc: string, width = 60): string =>
  `  ${ANSI_GREEN}$ ${cmd.padEnd(width)}${ANSI_RESET}${ANSI_DIM}${desc}${ANSI_RESET}`;

const section = (title: string, lines: string[]): string =>
  `${heading(title)}\n${lines.join("\n")}`;

// --- Shared help sections ---

const GLOBAL_OPTIONS = section("GLOBAL OPTIONS", [
  opt("--help, -h", "Show this help message"),
  opt("--version, -v", "Show version number"),
  opt("--token, -t <token>", "Bot token (overrides DISCORD_BOT_TOKEN)"),
]);

const SEARCH_FILTERING = section("FILTERING", [
  opt("--guild, -g <id>", "Guild/server ID (required)"),
  opt("--content <text>", "Content text filter"),
  opt("--channel-id <ids>", "Channel IDs (comma-separated)"),
  opt("--include-nsfw", "Include NSFW channels"),
  opt("--pinned", "Only pinned messages"),
  opt("--slop <n>", "Fuzzy match slop value"),
]);

const SEARCH_AUTHORS = section("AUTHORS & MENTIONS", [
  opt("--author-id <ids>", "Author IDs (comma-separated)"),
  opt("--author-type <type>", "Author type: user, bot, webhook"),
  opt("--mentions <ids>", "Mentioned user IDs (comma-separated)"),
  opt("--mentions-role-id <ids>", "Mentioned role IDs (comma-separated)"),
  opt("--mention-everyone", "Filter for @everyone mentions"),
  opt("--replied-to-user <ids>", "Replied-to user IDs (comma-separated)"),
  opt("--replied-to-message <ids>", "Replied-to message IDs (comma-separated)"),
]);

const SEARCH_CONTENT_TYPE = section("CONTENT TYPE", [
  opt(
    "--has <types>",
    "embed, image, video, file, link, sticker, sound, poll, snapshot"
  ),
  opt("--embed-type <types>", "Embed types: image, video, gif, sound, article"),
  opt("--embed-provider <names>", "Embed providers (comma-separated)"),
  opt("--link-hostname <hosts>", "Link hostnames (comma-separated)"),
  opt(
    "--attachment-filename <names>",
    "Attachment filenames (comma-separated)"
  ),
  opt(
    "--attachment-extension <exts>",
    "Attachment extensions (comma-separated)"
  ),
]);

const SEARCH_SORTING = section("SORTING & RANGE", [
  opt("--sort-by <field>", "Sort by: timestamp, relevance"),
  opt("--sort-order <order>", "Sort order: asc, desc"),
  opt("--min-id <id>", "Minimum snowflake ID"),
  opt("--max-id <id>", "Maximum snowflake ID"),
  opt("--offset <n>", "Skip first N results (max 9975)"),
  opt("--limit <n>", "Max number of messages to fetch"),
]);

const SEARCH_OUTPUT = section("OUTPUT", [
  opt("--export <format>", "json, csv-messages, csv-embeds, csv-fields, all"),
  opt("--output-dir <path>", "Output directory for exports"),
  opt("--json", "Output raw JSON to stdout (for piping)"),
  opt("--save-preset <name>", "Save search params as a preset"),
]);

const PRESET_ACTIONS = section("ACTIONS", [
  opt("list", "List all saved presets"),
  opt("run <name>", "Run a saved preset"),
  opt("run-all [names...]", "Run multiple presets (or --all)"),
  opt("save <name> [opts]", "Save a new preset"),
  opt("delete <name>", "Delete a preset"),
]);

const SETTINGS_ACTIONS = section("ACTIONS", [
  opt("show", "Show current settings"),
  opt("set <key> <value>", "Set a setting (token, client-id, guild)"),
  opt("invite", "Generate bot invite link"),
]);

// --- Per-subcommand help ---

const SEARCH_HELP_TEXT = [
  `${ANSI_BOLD}discord-search search${ANSI_RESET}\n${ANSI_DIM}Search Discord server messages with filters.${ANSI_RESET}`,
  section("USAGE", [
    opt("discord-search search [options]", "Run a search", 42),
  ]),
  SEARCH_FILTERING,
  SEARCH_AUTHORS,
  SEARCH_CONTENT_TYPE,
  SEARCH_SORTING,
  SEARCH_OUTPUT,
  section("EXAMPLES", [
    example(
      'discord-search search -g 123 --content "hello"',
      'Search for "hello"'
    ),
    example(
      "discord-search search -g 123 --has embed --json",
      "Search embeds, JSON output"
    ),
    example(
      "discord-search search -g 123 --limit 50",
      "Fetch at most 50 messages"
    ),
    example("discord-search search -g 123 --export all", "Export all formats"),
  ]),
].join("\n\n");

const PRESET_HELP_TEXT = [
  `${ANSI_BOLD}discord-search preset${ANSI_RESET}\n${ANSI_DIM}Save, load, and manage search presets.${ANSI_RESET}`,
  section("USAGE", [
    opt("discord-search preset <action>", "Manage presets", 42),
  ]),
  PRESET_ACTIONS,
  section("EXAMPLES", [
    example("discord-search preset list", "List presets"),
    example(
      "discord-search preset run my-search --export json",
      "Run preset and export"
    ),
    example(
      'discord-search preset save my-search -g 123 --content "hi"',
      "Save a preset"
    ),
    example("discord-search preset delete my-search", "Delete a preset"),
  ]),
].join("\n\n");

const SETTINGS_HELP_TEXT = [
  `${ANSI_BOLD}discord-search settings${ANSI_RESET}\n${ANSI_DIM}View and manage CLI settings.${ANSI_RESET}`,
  section("USAGE", [
    opt("discord-search settings <action>", "Manage settings", 42),
  ]),
  SETTINGS_ACTIONS,
  section("EXAMPLES", [
    example("discord-search settings show", "View settings"),
    example("discord-search settings set guild 123456", "Set default guild"),
    example("discord-search settings invite", "Generate bot invite link"),
  ]),
].join("\n\n");

// --- Full help ---

const HELP_TEXT = [
  `${ANSI_BOLD}discord-search${ANSI_RESET}\n${ANSI_DIM}Search Discord server messages from your terminal.${ANSI_RESET}\n${ANSI_DIM}Filter by author, content type, mentions, and more.${ANSI_RESET}`,

  section("COMMANDS", [
    opt("search [options]", "Run a search"),
    opt("preset <action>", "Manage presets"),
    opt("settings <action>", "Manage settings"),
    opt("(no command)", "Interactive mode"),
  ]),

  GLOBAL_OPTIONS,

  `${ANSI_DIM}Run ${ANSI_YELLOW}discord-search <command> --help${ANSI_RESET}${ANSI_DIM} for command-specific help.${ANSI_RESET}`,

  section("ENVIRONMENT VARIABLES", [
    opt("DISCORD_BOT_TOKEN", "Bot token for authentication (required)"),
    opt("DISCORD_GUILD_ID", "Default guild ID (optional)"),
    opt("DISCORD_CLIENT_ID", "Application client ID (optional)"),
  ]),
].join("\n\n");

const SUBCOMMAND_HELP: Record<"search" | "preset" | "settings", string> = {
  search: SEARCH_HELP_TEXT,
  preset: PRESET_HELP_TEXT,
  settings: SETTINGS_HELP_TEXT,
};

export { HELP_TEXT, SUBCOMMAND_HELP };

export const exitWithError = (message: string, subcommand?: string): never => {
  process.stderr.write(`${ANSI_RED}Error: ${message}${ANSI_RESET}\n`);

  const baseCommand = subcommand?.split(" ")[0] as
    | "search"
    | "preset"
    | "settings"
    | undefined;
  if (baseCommand && baseCommand in SUBCOMMAND_HELP) {
    process.stderr.write(
      `\n${ANSI_DIM}Run ${ANSI_YELLOW}discord-search ${baseCommand} --help${ANSI_RESET}${ANSI_DIM} for usage info.${ANSI_RESET}\n`
    );
  } else {
    process.stderr.write(
      `\n${ANSI_DIM}Run ${ANSI_YELLOW}discord-search --help${ANSI_RESET}${ANSI_DIM} for usage info.${ANSI_RESET}\n`
    );
  }

  process.exit(1);
};
