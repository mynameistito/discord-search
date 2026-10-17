import { confirm, log, password, select, text } from "@clack/prompts";
import { Result } from "better-result";

import {
  parseBooleanPrompt,
  parseTextPrompt,
  promptForToken,
} from "@/cli/prompts.ts";
import { generateInviteLink, saveSettings } from "@/config.ts";
import type { loadConfig, SettingsJson } from "@/config.ts";
import type { AppState } from "@/types.ts";

const showCurrentSettings = (state: AppState): void => {
  const tokenSummary =
    state.token !== undefined && state.token.length > 0
      ? `***${state.token.slice(-6)}`
      : "(not set)";

  const lines = [
    `  Bot token: ${tokenSummary}`,
    `  Client ID: ${state.clientId ?? "(not set)"}`,
    `  Default guild: ${state.defaultGuildId ?? "(not set)"}`,
  ];

  log.info(`Current settings:\n${lines.join("\n")}`);
};

/**
 * Persist the defined application settings.
 *
 * @param state - Current CLI settings.
 * @returns Success or the persistence error.
 */
export const saveStateToSettings = async (
  state: AppState
): Promise<Result<void, Error>> => {
  const values: SettingsJson = {};

  if (state.token !== undefined && state.token.length > 0) {
    values.token = state.token;
  }

  if (state.clientId !== undefined && state.clientId.length > 0) {
    values.clientId = state.clientId;
  }

  if (state.defaultGuildId !== undefined && state.defaultGuildId.length > 0) {
    values.guildId = state.defaultGuildId;
  }

  const result = await saveSettings(values);

  if (result.isOk()) {
    log.success("Saved settings to ~/.discord-search/settings.json");

    return Result.ok();
  }

  log.error(`Failed to save settings: ${result.error.message}`);

  return Result.err(result.error);
};

const handleSettingsAction = async (
  action: string,
  state: AppState
): Promise<void> => {
  if (action === "token") {
    const newToken = await password({ message: "Enter new bot token:" });
    state.token = parseTextPrompt(newToken);
    log.success("Bot token updated.");
  } else if (action === "client-id") {
    const input = await text({
      initialValue: state.clientId ?? "",
      message: "Enter Discord Application Client ID:",
    });

    state.clientId = parseTextPrompt(input).trim() || undefined;
    log.success("Client ID updated.");
  } else if (action === "guild") {
    const input = await text({
      initialValue: state.defaultGuildId ?? "",
      message: "Enter default guild/server ID:",
    });

    state.defaultGuildId = parseTextPrompt(input).trim() || undefined;
    log.success("Default guild ID updated.");
  } else if (action === "invite") {
    const { clientId } = state;

    if (clientId === undefined || clientId.length === 0) {
      log.warn("Set a Client ID first.");

      return;
    }

    const link = generateInviteLink(clientId);
    log.info(`Bot invite link:\n  ${link}`);
  } else if (action === "save") {
    await saveStateToSettings(state);
  }
};

const runSettingsMenu = async (state: AppState): Promise<boolean> => {
  showCurrentSettings(state);

  const action = parseTextPrompt(
    await select({
      message: "Settings:",
      options: [
        { label: "Update bot token", value: "token" },
        { label: "Update client ID", value: "client-id" },
        { label: "Set default guild/server ID", value: "guild" },
        { label: "Generate bot invite link", value: "invite" },
        { label: "Save settings", value: "save" },
        { label: "Back", value: "back" },
      ],
    })
  );

  if (action === "back") {
    return true;
  }

  await handleSettingsAction(action, state);

  return await runSettingsMenu(state);
};

/**
 * Display and update settings through the interactive CLI menu.
 *
 * @param state - Mutable CLI settings to display and update.
 * @returns When the user exits the settings menu.
 */
export const handleSettings = async (state: AppState): Promise<void> => {
  await runSettingsMenu(state);
};

/**
 * Resolve a bot token from CLI, config, or an interactive prompt.
 *
 * @param cliToken - Optional token supplied on the command line.
 * @param configResult - Configuration loaded from environment or disk.
 * @returns The resolved token.
 */
export const resolveToken = async (
  cliToken: string | undefined,
  configResult: Awaited<ReturnType<typeof loadConfig>>
): Promise<string> => {
  if (cliToken !== undefined && cliToken.length > 0) {
    return cliToken;
  }

  if (configResult.isOk()) {
    return configResult.value.token;
  }

  log.warn("No DISCORD_BOT_TOKEN found in environment or settings.");
  const token = await promptForToken();

  const shouldSave = parseBooleanPrompt(
    await confirm({
      initialValue: true,
      message: "Save token to settings?",
    })
  );

  if (shouldSave) {
    await saveStateToSettings({
      clientId: "",
      defaultGuildId: "",
      token,
    });
  }

  return token;
};

// --- Non-interactive settings operations ---

/** Resolve a token without prompting.
 *
 * @param cliToken - Optional token supplied on the command line.
 * @param configResult - Configuration loaded from environment or disk.
 * @returns The token, or an error when none is available.
 */
export const resolveTokenNonInteractive = (
  cliToken: string | undefined,
  configResult: Awaited<ReturnType<typeof loadConfig>>
): Result<string, Error> => {
  if (cliToken !== undefined && cliToken.length > 0) {
    return Result.ok(cliToken);
  }

  if (configResult.isOk()) {
    return Result.ok(configResult.value.token);
  }

  return Result.err(
    new Error("No token found. Provide --token or set DISCORD_BOT_TOKEN.")
  );
};

/**
 * Print redacted settings as JSON for non-interactive use.
 *
 * @param state - Current CLI settings.
 */
export const showSettingsNonInteractive = (state: AppState): void => {
  process.stdout.write(
    JSON.stringify(
      {
        clientId: state.clientId ?? null,
        defaultGuildId: state.defaultGuildId ?? null,
        token:
          state.token !== undefined && state.token.length > 0
            ? `***${state.token.slice(-6)}`
            : null,
      },
      null,
      2
    )
  );
  process.stdout.write("\n");
};

/** Update one setting and persist the new state.
 *
 * @param key - Setting name accepted by the CLI.
 * @param value - New setting value.
 * @param state - Mutable CLI settings to update.
 */
export const setSettingNonInteractive = async (
  key: string,
  value: string,
  state: AppState
): Promise<void> => {
  const normalized = value.trim() || undefined;

  if (key === "token") {
    state.token = normalized;
  } else if (key === "client-id") {
    state.clientId = normalized;
  } else if (key === "guild") {
    state.defaultGuildId = normalized;
  } else {
    process.stderr.write(
      `Unknown setting: ${key}. Valid keys: token, client-id, guild\n`
    );
    process.exit(1);
  }

  const result = await saveStateToSettings(state);

  if (result.isErr()) {
    process.stderr.write(
      `Failed to persist setting: ${result.error.message}\n`
    );
    process.exit(1);
  }

  process.stderr.write(`Updated ${key}.\n`);
};

/** Print a bot invite URL in non-interactive mode.
 *
 * @param clientId - Discord application client ID, if configured.
 */
export const showInviteLinkNonInteractive = (
  clientId: string | undefined
): void => {
  if (clientId === undefined || clientId.length === 0) {
    process.stderr.write(
      "Error: Client ID required. Use --client-id or set DISCORD_CLIENT_ID.\n"
    );
    process.exit(1);
  }

  process.stdout.write(`${generateInviteLink(clientId)}\n`);
};
