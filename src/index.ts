#!/usr/bin/env node
import { intro, outro, select } from "@clack/prompts";
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
import { type loadConfig, loadConfig as loadConfigFn } from "@/config.ts";
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
    await handleRunAllPresets(state.token);
    return true;
  }

  if (action === "settings") {
    await handleSettings(state);
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
    token,
    clientId:
      cliArgs.clientId ??
      (configResult.isOk() ? configResult.value.clientId : undefined),
    defaultGuildId:
      cliArgs.guild ??
      (configResult.isOk() ? configResult.value.defaultGuildId : undefined),
  };

  while (true) {
    const action = await select({
      message: "What would you like to do?",
      options: [
        { value: "search", label: "New search" },
        { value: "preset", label: "Load preset" },
        { value: "run-all", label: "Bulk run presets" },
        { value: "manage", label: "Manage presets" },
        { value: "settings", label: "Settings" },
        { value: "exit", label: "Exit" },
      ],
    });
    handleCancel(action);

    const shouldContinue = await handleMenuAction(action as string, state);
    if (!shouldContinue) {
      break;
    }
  }

  outro("Goodbye!");
};

const handleSearchCommand = async (
  cliArgs: SearchArgs,
  configResult: ConfigResult
): Promise<void> => {
  if (!cliArgs.params.guildId) {
    exitWithError("--guild is required for search.", "search");
  }
  const token = resolveTokenNonInteractive(cliArgs.token, configResult);
  await executeNonInteractiveSearch(cliArgs.params, token, {
    export: cliArgs.export,
    outputDir: cliArgs.outputDir,
    json: cliArgs.json,
  });

  if (cliArgs.savePreset) {
    await savePreset(cliArgs.savePreset, cliArgs.params);
    process.stderr.write(`Saved preset: ${cliArgs.savePreset}\n`);
  }
};

const handlePresetRunCommand = async (
  cliArgs: PresetRunArgs,
  configResult: ConfigResult
): Promise<void> => {
  const token = resolveTokenNonInteractive(cliArgs.token, configResult);
  await runPresetNonInteractive(cliArgs.name, token, {
    export: cliArgs.export,
    outputDir: cliArgs.outputDir,
    json: cliArgs.json,
  });
};

const handlePresetRunAllCommand = async (
  cliArgs: PresetRunAllArgs,
  configResult: ConfigResult
): Promise<void> => {
  const token = resolveTokenNonInteractive(cliArgs.token, configResult);
  await runAllPresetsNonInteractive(cliArgs.names, cliArgs.all, token, {
    export: cliArgs.export,
    outputDir: cliArgs.outputDir,
  });
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
  token: configResult.isOk() ? configResult.value.token : (cliToken ?? ""),
  clientId: configResult.isOk() ? configResult.value.clientId : undefined,
  defaultGuildId: configResult.isOk()
    ? configResult.value.defaultGuildId
    : undefined,
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
    const subHelp = SUBCOMMAND_HELP[cliArgs.command];
    console.log(subHelp ?? HELP_TEXT);
    process.exit(0);
  }

  if (cliArgs.version) {
    const pkg = await Bun.file(
      new URL("../package.json", import.meta.url)
    ).json();
    console.log(`discord-search ${pkg.version as string}`);
    process.exit(0);
  }

  if (cliArgs.command === "interactive") {
    await runInteractive(cliArgs);
  } else {
    await runNonInteractive(cliArgs);
  }
};

main();
