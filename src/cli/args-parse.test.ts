import { describe, expect, it } from "vitest";

import { parseArgs } from "@/cli/args-parse.ts";

describe("CLI argument parsing", () => {
  it("global --help returns help command", () => {
    const args = parseArgs(["--help"]);

    expect(args.command).toBe("help");

    if (args.command !== "help") {
      throw new Error("Expected help command");
    }

    expect(args.help).toBeTruthy();
  });

  it("search --help returns help command with targetCommand search", () => {
    const args = parseArgs(["search", "--help"]);

    expect(args.command).toBe("help");

    if (args.command !== "help") {
      throw new Error("Expected help command");
    }

    expect(args.targetCommand).toBe("search");
    expect(args.help).toBeTruthy();
  });

  it("search --help with --guild still returns help command", () => {
    const args = parseArgs(["search", "--help", "--guild", "123"]);

    expect(args.command).toBe("help");

    if (args.command !== "help") {
      throw new Error("Expected help command");
    }

    expect(args.targetCommand).toBe("search");
    expect(args.help).toBeTruthy();
  });

  it("no subcommand without --help returns interactive command", () => {
    const args = parseArgs([]);

    expect(args.command).toBe("interactive");
  });

  it("no subcommand with --help returns help command (not interactive)", () => {
    const args = parseArgs(["--help"]);

    expect(args.command).toBe("help");
    expect(args.command).not.toBe("interactive");
  });
});
