import { expect, test } from "bun:test";
import { parseArgs } from "@/cli/args-parse.ts";
import type { HelpArgs } from "@/cli/args-types.ts";

test("global --help returns help command", () => {
  const args = parseArgs(["--help"]);
  expect(args.command).toBe("help");
  expect((args as HelpArgs).help).toBe(true);
});

test("search --help returns help command with targetCommand search", () => {
  const args = parseArgs(["search", "--help"]);
  expect(args.command).toBe("help");
  const helpArgs = args as HelpArgs;
  expect(helpArgs.targetCommand).toBe("search");
  expect(helpArgs.help).toBe(true);
});

test("search --help with --guild still returns help command", () => {
  const args = parseArgs(["search", "--help", "--guild", "123"]);
  expect(args.command).toBe("help");
  const helpArgs = args as HelpArgs;
  expect(helpArgs.targetCommand).toBe("search");
  expect(helpArgs.help).toBe(true);
});

test("no subcommand without --help returns interactive command", () => {
  const args = parseArgs([]);
  expect(args.command).toBe("interactive");
});

test("no subcommand with --help returns help command (not interactive)", () => {
  const args = parseArgs(["--help"]);
  expect(args.command).toBe("help");
  expect(args.command).not.toBe("interactive");
});
