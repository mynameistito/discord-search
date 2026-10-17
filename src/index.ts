#!/usr/bin/env node
import { readFile } from "node:fs/promises";

import { intro, log, outro, select } from "@clack/prompts";
import { z } from "zod";

import { exitWithError, HELP_TEXT, SUBCOMMAND_HELP } from "@/cli/args-help.ts";
import { parseArgs } from "@/cli/args-parse.ts";
import type {
  ParsedArgs,
  PresetDeleteArgs,
  PresetRunAllArgs,
  PresetRunArgs,
  PresetSaveArgs,
  SearchArgs,
  SettingsInviteArgs,
  SettingsSetArgs,
  SettingsShowArgs,
} from "@/cli/args-types.ts";
import { handleCancel } from "@/cli/prompts.ts";
import { loadConfig as loadConfigFn } from "@/config.ts";
import type { loadConfig } from "@/config.ts";
import {
  deletePresetNonInteractive,
  handleManagePresets,
  handleRunAllPresets,
  listPresetsNonInteractive,
  resolveSearchParams,
  runAllPresetsNonInteractive,
  runPresetNonInteractive,
  savePresetNonInteractive,
} from "@/handlers/presets.ts";
import {
  executeNonInteractiveSearch,
  executeSearch,
} from "@/handlers/search.ts";
import {
  handleSettings,
  resolveToken,
  resolveTokenNonInteractive,
  setSettingNonInteractive,
  showInviteLinkNonInteractive,
  showSettingsNonInteractive,
} from "@/handlers/settings.ts";
import { ensureAppDir } from "@/paths.ts";
import { savePreset } from "@/presets.ts";
import type { AppState } from "@/types.ts";

type ConfigResult = Awaited<ReturnType<typeof loadConfig>>;

const MenuActionSchema = z.enum([
  "search",
  "preset",
  "run-all",
  "manage",
  "settings",
  "exit",
]);

const PackageVersionSchema = z.object({ version: z.string() });

const handleMenuAction = async (
  action: string,
  state: AppState
): Promise<boolean> => {
  if (action === "exit") {
    return false;
  }

  if (action === "manage") {
    await handleManagePresets();

    return true;
  }

  if (action === "run-all") {
    if (state.token === undefined || state.token.length === 0) {
      log.error("No token configured. Update your token in Settings first.");

      return true;
    }

    await handleRunAllPresets(state.token);

    return true;
  }

  if (action === "settings") {
    await handleSettings(state);

    return true;
  }

  if (state.token === undefined || state.token.length === 0) {
    log.error("No token configured. Update your token in Settings first.");

    return true;
  }

  const searchParams = await resolveSearchParams(action, state.defaultGuildId);

  if (searchParams) {
    await executeSearch(searchParams, state.token);
  }

  return true;
};

const runInteractive = async (cliArgs: ParsedArgs): Promise<void> => {
  if (cliArgs.command !== "interactive") {
    return;
  }

  intro("Discord Search");

  await ensureAppDir();
  const configResult = await loadConfigFn();
  const token = await resolveToken(cliArgs.token, configResult);

  const state: AppState = {
    clientId:
      cliArgs.clientId ??
      (configResult.isOk() ? configResult.value.clientId : undefined),
    defaultGuildId:
      cliArgs.guild ??
      (configResult.isOk() ? configResult.value.defaultGuildId : undefined),
    token,
  };

  const runMenu = async (): Promise<void> => {
    const action = await select({
      message: "What would you like to do?",
      options: [
        { label: "New search", value: "search" },
        { label: "Load preset", value: "preset" },
        { label: "Bulk run presets", value: "run-all" },
        { label: "Manage presets", value: "manage" },
        { label: "Settings", value: "settings" },
        { label: "Exit", value: "exit" },
      ],
    });

    handleCancel(action);

    const shouldContinue = await handleMenuAction(
      MenuActionSchema.parse(action),
      state
    );

    if (shouldContinue) {
      await runMenu();
    }
  };

  await runMenu();

  outro("Goodbye!");
};

const handleSearchCommand = async (
  cliArgs: SearchArgs,
  configResult: ConfigResult
): Promise<void> => {
  if (cliArgs.params.guildId.length === 0) {
    exitWithError("--guild is required for search.", "search");

    return;
  }

  const tokenResult = resolveTokenNonInteractive(cliArgs.token, configResult);

  if (tokenResult.isErr()) {
    exitWithError(tokenResult.error.message, "search");

    return;
  }

  await executeNonInteractiveSearch(cliArgs.params, tokenResult.value, {
    export: cliArgs.export,
    json: cliArgs.json,
    outputDir: cliArgs.outputDir,
  });

  if (cliArgs.savePreset !== undefined) {
    const saveResult = await savePreset(cliArgs.savePreset, cliArgs.params);

    if (saveResult.isErr()) {
      exitWithError(
        `Failed to save preset "${cliArgs.savePreset}": ${saveResult.error.message}`,
        "preset"
      );

      return;
    }

    process.stderr.write(`Saved preset: ${cliArgs.savePreset}\n`);
  }
};

const handlePresetRunCommand = async (
  cliArgs: PresetRunArgs,
  configResult: ConfigResult
): Promise<void> => {
  const tokenResult = resolveTokenNonInteractive(cliArgs.token, configResult);

  if (tokenResult.isErr()) {
    exitWithError(tokenResult.error.message, "preset");

    return;
  }

  await runPresetNonInteractive(cliArgs.name, tokenResult.value, {
    export: cliArgs.export,
    json: cliArgs.json,
    outputDir: cliArgs.outputDir,
  });
};

const handlePresetRunAllCommand = async (
  cliArgs: PresetRunAllArgs,
  configResult: ConfigResult
): Promise<void> => {
  const tokenResult = resolveTokenNonInteractive(cliArgs.token, configResult);

  if (tokenResult.isErr()) {
    exitWithError(tokenResult.error.message, "preset");

    return;
  }

  await runAllPresetsNonInteractive(
    cliArgs.names,
    cliArgs.all,
    tokenResult.value,
    {
      export: cliArgs.export,
      outputDir: cliArgs.outputDir,
    }
  );
};

const handlePresetSaveCommand = async (
  cliArgs: PresetSaveArgs
): Promise<void> => {
  await savePresetNonInteractive(cliArgs.name, cliArgs.params);
};

const handlePresetDeleteCommand = async (
  cliArgs: PresetDeleteArgs
): Promise<void> => {
  await deletePresetNonInteractive(cliArgs.name);
};

const buildStateFromConfig = (
  configResult: ConfigResult,
  cliToken?: string
): AppState => ({
  clientId: configResult.isOk() ? configResult.value.clientId : undefined,
  defaultGuildId: configResult.isOk()
    ? configResult.value.defaultGuildId
    : undefined,
  token: configResult.isOk() ? configResult.value.token : cliToken,
});

const handleSettingsShowCommand = (
  cliArgs: SettingsShowArgs,
  configResult: ConfigResult
): void => {
  showSettingsNonInteractive(buildStateFromConfig(configResult, cliArgs.token));
};

const handleSettingsSetCommand = async (
  cliArgs: SettingsSetArgs,
  configResult: ConfigResult
): Promise<void> => {
  const state = buildStateFromConfig(configResult, cliArgs.token);
  await setSettingNonInteractive(cliArgs.key, cliArgs.value, state);
};

const handleSettingsInviteCommand = (
  cliArgs: SettingsInviteArgs,
  configResult: ConfigResult
): void => {
  const clientId =
    cliArgs.clientId ??
    (configResult.isOk() ? configResult.value.clientId : undefined);

  showInviteLinkNonInteractive(clientId);
};

const handlePresetCommand = async (
  cliArgs: ParsedArgs,
  configResult: ConfigResult
): Promise<void> => {
  if (cliArgs.command !== "preset") {
    return;
  }

  if (cliArgs.action === "list") {
    await listPresetsNonInteractive();
  } else if (cliArgs.action === "run") {
    await handlePresetRunCommand(cliArgs, configResult);
  } else if (cliArgs.action === "run-all") {
    await handlePresetRunAllCommand(cliArgs, configResult);
  } else if (cliArgs.action === "save") {
    await handlePresetSaveCommand(cliArgs);
  } else if (cliArgs.action === "delete") {
    await handlePresetDeleteCommand(cliArgs);
  }
};

const handleSettingsCommand = async (
  cliArgs: ParsedArgs,
  configResult: ConfigResult
): Promise<void> => {
  if (cliArgs.command !== "settings") {
    return;
  }

  if (cliArgs.action === "show") {
    handleSettingsShowCommand(cliArgs, configResult);
  } else if (cliArgs.action === "set") {
    await handleSettingsSetCommand(cliArgs, configResult);
  } else if (cliArgs.action === "invite") {
    handleSettingsInviteCommand(cliArgs, configResult);
  }
};

const runNonInteractive = async (cliArgs: ParsedArgs): Promise<void> => {
  await ensureAppDir();
  const configResult = await loadConfigFn();

  if (cliArgs.command === "search") {
    await handleSearchCommand(cliArgs, configResult);
  } else if (cliArgs.command === "preset") {
    await handlePresetCommand(cliArgs, configResult);
  } else if (cliArgs.command === "settings") {
    await handleSettingsCommand(cliArgs, configResult);
  }
};

const main = async (): Promise<void> => {
  const cliArgs = parseArgs(process.argv.slice(2));

  if (cliArgs.help) {
    const subHelp =
      cliArgs.command === "search" ||
      cliArgs.command === "preset" ||
      cliArgs.command === "settings"
        ? SUBCOMMAND_HELP[cliArgs.command]
        : undefined;

    console.log(subHelp ?? HELP_TEXT);
    process.exit(0);
  }

  if (cliArgs.version) {
    const pkg: unknown = JSON.parse(
      await readFile(new URL("../package.json", import.meta.url), "utf-8")
    );

    const parsedPackage = PackageVersionSchema.safeParse(pkg);

    const version = parsedPackage.success
      ? parsedPackage.data.version
      : "unknown";

    console.log(`discord-search ${version}`);
    process.exit(0);
  }

  await (cliArgs.command === "interactive"
    ? runInteractive(cliArgs)
    : runNonInteractive(cliArgs));
};

const run = async (): Promise<void> => {
  try {
    await main();
  } catch (error: unknown) {
    console.error(
      error instanceof Error ? (error.stack ?? error.message) : String(error)
    );
    process.exit(1);
  }
};

void run();
