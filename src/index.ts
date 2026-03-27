#!/usr/bin/env node

import { HELP_TEXT, SUBCOMMAND_HELP } from "@/cli/args-help.ts";
import { parseArgs } from "@/cli/args-parse.ts";
import type { ParsedArgs } from "@/cli/args-types.ts";

const VERSION = "0.0.0";

const printHelp = (parsed: ParsedArgs & { command: "help" }) => {
  const target = parsed.targetCommand;
  const helpText = target ? SUBCOMMAND_HELP[target] : HELP_TEXT;
  process.stdout.write(`${helpText}\n`);
};

const printVersion = () => {
  process.stdout.write(`discord-search ${VERSION}\n`);
};

const run = () => {
  const parsed = parseArgs(process.argv.slice(2));

  if (parsed.version) {
    printVersion();
    process.exitCode = 0;
    return;
  }

  if (parsed.command === "help") {
    printHelp(parsed);
    process.exitCode = 0;
    return;
  }

  if (parsed.command === "interactive") {
    process.stderr.write(
      "Interactive mode is not yet implemented. Use 'discord-search search --help' for CLI usage.\n"
    );
    process.exitCode = 1;
    return;
  }

  if (parsed.command === "search") {
    process.stderr.write("Search command execution is not yet implemented.\n");
    process.exitCode = 1;
    return;
  }

  if (parsed.command === "preset") {
    process.stderr.write("Preset command execution is not yet implemented.\n");
    process.exitCode = 1;
    return;
  }

  if (parsed.command === "settings") {
    process.stderr.write(
      "Settings command execution is not yet implemented.\n"
    );
    process.exitCode = 1;
    return;
  }
};

run();
