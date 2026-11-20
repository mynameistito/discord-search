#!/usr/bin/env node
import { readFile } from "node:fs/promises";

import { intro, log, outro, select } from "@clack/prompts";
import { Result, Schema } from "effect";

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
import { disposeRuntime, runOperation } from "@/cli/runtime.ts";
import { loadConfig as loadConfigFn } from "@/config.ts";
import type { Config } from "@/config.ts";
import type { ConfigError } from "@/errors.ts";
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

type ConfigResult = Result.Result<Config, ConfigError>;

const MenuActionSchema = Schema.Literals([
  "search",
  "preset",
  "run-all",
  "manage",
  "settings",
  "exit",
]);

const PackageVersionSchema = Schema.Struct({ version: Schema.String });

const handleMenuAction = async (action: string, state: AppState) => {
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

const runInteractive = async (cliArgs: ParsedArgs) => {
  if (cliArgs.command !== "interactive") {
    return;
  }

  intro("Discord Search");

  await ensureAppDir();
  const configResult = await runOperation(loadConfigFn());
  const token = await resolveToken(cliArgs.token, configResult);

  const state: AppState = {
    clientId:
      cliArgs.clientId ??
      (Result.isSuccess(configResult)
        ? configResult.success.clientId
        : undefined),
    defaultGuildId:
      cliArgs.guild ??
      (Result.isSuccess(configResult)
        ? configResult.success.defaultGuildId
        : undefined),
    token,
  };

  const runMenu = async () => {
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
      Schema.decodeUnknownSync(MenuActionSchema)(action),
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
) => {
  if (cliArgs.params.guildId.length === 0) {
    exitWithError("--guild is required for search.", "search");

    return;
  }

  const tokenResult = resolveTokenNonInteractive(cliArgs.token, configResult);

  if (Result.isFailure(tokenResult)) {
    exitWithError(tokenResult.failure.message, "search");

    return;
  }

  await executeNonInteractiveSearch(cliArgs.params, tokenResult.success, {
    export: cliArgs.export,
    json: cliArgs.json,
    outputDir: cliArgs.outputDir,
  });

  if (cliArgs.savePreset !== undefined) {
    const saveResult = await runOperation(
      savePreset(cliArgs.savePreset, cliArgs.params)
    );

    if (Result.isFailure(saveResult)) {
      exitWithError(
        `Failed to save preset "${cliArgs.savePreset}": ${saveResult.failure.message}`,
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
) => {
  const tokenResult = resolveTokenNonInteractive(cliArgs.token, configResult);

  if (Result.isFailure(tokenResult)) {
    exitWithError(tokenResult.failure.message, "preset");

    return;
  }

  await runPresetNonInteractive(cliArgs.name, tokenResult.success, {
    export: cliArgs.export,
    json: cliArgs.json,
    outputDir: cliArgs.outputDir,
  });
};

const handlePresetRunAllCommand = async (
  cliArgs: PresetRunAllArgs,
  configResult: ConfigResult
) => {
  const tokenResult = resolveTokenNonInteractive(cliArgs.token, configResult);

  if (Result.isFailure(tokenResult)) {
    exitWithError(tokenResult.failure.message, "preset");

    return;
  }

  await runAllPresetsNonInteractive(
    cliArgs.names,
    cliArgs.all,
    tokenResult.success,
    {
      export: cliArgs.export,
      outputDir: cliArgs.outputDir,
    }
  );
};

const handlePresetSaveCommand = async (cliArgs: PresetSaveArgs) => {
  await savePresetNonInteractive(cliArgs.name, cliArgs.params);
};

const handlePresetDeleteCommand = async (cliArgs: PresetDeleteArgs) => {
  await deletePresetNonInteractive(cliArgs.name);
};

const buildStateFromConfig = (
  configResult: ConfigResult,
  cliToken?: string
) => ({
  clientId: Result.isSuccess(configResult)
    ? configResult.success.clientId
    : undefined,
  defaultGuildId: Result.isSuccess(configResult)
    ? configResult.success.defaultGuildId
    : undefined,
  token: Result.isSuccess(configResult) ? configResult.success.token : cliToken,
});

const handleSettingsShowCommand = (
  cliArgs: SettingsShowArgs,
  configResult: ConfigResult
) => {
  showSettingsNonInteractive(buildStateFromConfig(configResult, cliArgs.token));
};

const handleSettingsSetCommand = async (
  cliArgs: SettingsSetArgs,
  configResult: ConfigResult
) => {
  const state = buildStateFromConfig(configResult, cliArgs.token);
  await setSettingNonInteractive(cliArgs.key, cliArgs.value, state);
};

const handleSettingsInviteCommand = (
  cliArgs: SettingsInviteArgs,
  configResult: ConfigResult
) => {
  const clientId =
    cliArgs.clientId ??
    (Result.isSuccess(configResult)
      ? configResult.success.clientId
      : undefined);

  showInviteLinkNonInteractive(clientId);
};

const handlePresetCommand = async (
  cliArgs: ParsedArgs,
  configResult: ConfigResult
) => {
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
) => {
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

const runNonInteractive = async (cliArgs: ParsedArgs) => {
  await ensureAppDir();
  const configResult = await runOperation(loadConfigFn());

  if (cliArgs.command === "search") {
    await handleSearchCommand(cliArgs, configResult);
  } else if (cliArgs.command === "preset") {
    await handlePresetCommand(cliArgs, configResult);
  } else if (cliArgs.command === "settings") {
    await handleSettingsCommand(cliArgs, configResult);
  }
};

const main = async () => {
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

    const parsedPackage = Schema.decodeUnknownResult(PackageVersionSchema)(pkg);

    const version = Result.isSuccess(parsedPackage)
      ? parsedPackage.success.version
      : "unknown";

    console.log(`discord-search ${version}`);
    process.exit(0);
  }

  await (cliArgs.command === "interactive"
    ? runInteractive(cliArgs)
    : runNonInteractive(cliArgs));
};

const run = async () => {
  try {
    await main();
  } catch (error: unknown) {
    console.error(
      error instanceof Error ? (error.stack ?? error.message) : String(error)
    );
    process.exitCode = 1;
  } finally {
    await disposeRuntime();
  }
};

void run();
