import { confirm, log, password, select, text } from "@clack/prompts";
import { Result } from "better-result";
import { handleCancel, promptForToken } from "@/cli/prompts.ts";
import { generateInviteLink, type loadConfig, saveSettings } from "@/config.ts";
import type { AppState } from "@/types.ts";

const showCurrentSettings = (state: AppState): void => {
  const lines = [
    `  Bot token: ${state.token ? `***${state.token.slice(-6)}` : "(not set)"}`,
    `  Client ID: ${state.clientId ?? "(not set)"}`,
    `  Default guild: ${state.defaultGuildId ?? "(not set)"}`,
  ];
  log.info(`Current settings:\n${lines.join("\n")}`);
};

export const saveStateToSettings = async (
  state: AppState
): Promise<Result<void, Error>> => {
  const values: { token?: string; clientId?: string; guildId?: string } = {};
  if (state.token) {
    values.token = state.token;
  }
  if (state.clientId) {
    values.clientId = state.clientId;
  }
  if (state.defaultGuildId) {
    values.guildId = state.defaultGuildId;
  }

  const result = await saveSettings(values);
  if (result.isOk()) {
    log.success("Saved settings to ~/.discord-search/settings.json");
    return Result.ok(undefined);
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
    handleCancel(newToken);
    state.token = newToken as string;
    log.success("Bot token updated.");
  } else if (action === "client-id") {
    const input = await text({
      message: "Enter Discord Application Client ID:",
      initialValue: state.clientId ?? "",
    });
    handleCancel(input);
    state.clientId = (input as string).trim() || undefined;
    log.success("Client ID updated.");
  } else if (action === "guild") {
    const input = await text({
      message: "Enter default guild/server ID:",
      initialValue: state.defaultGuildId ?? "",
    });
    handleCancel(input);
    state.defaultGuildId = (input as string).trim() || undefined;
    log.success("Default guild ID updated.");
  } else if (action === "invite") {
    const clientId = state.clientId;
    if (!clientId) {
      log.warn("Set a Client ID first.");
      return;
    }
    const link = generateInviteLink(clientId);
    log.info(`Bot invite link:\n  ${link}`);
  } else if (action === "save") {
    await saveStateToSettings(state);
  }
};

export const handleSettings = async (state: AppState): Promise<void> => {
  while (true) {
    showCurrentSettings(state);

    const action = await select({
      message: "Settings:",
      options: [
        { value: "token", label: "Update bot token" },
        { value: "client-id", label: "Update client ID" },
        { value: "guild", label: "Set default guild/server ID" },
        { value: "invite", label: "Generate bot invite link" },
        { value: "save", label: "Save settings" },
        { value: "back", label: "Back" },
      ],
    });
    handleCancel(action);

    if (action === "back") {
      break;
    }

    await handleSettingsAction(action as string, state);
  }
};

export const resolveToken = async (
  cliToken: string | undefined,
  configResult: Awaited<ReturnType<typeof loadConfig>>
): Promise<string> => {
  if (cliToken) {
    return cliToken;
  }
  if (configResult.isOk()) {
    return configResult.value.token;
  }

  log.warn("No DISCORD_BOT_TOKEN found in environment or settings.");
  const token = await promptForToken();

  const shouldSave = await confirm({
    message: "Save token to settings?",
    initialValue: true,
  });
  handleCancel(shouldSave);

  if (shouldSave) {
    await saveStateToSettings({
      token,
      clientId: undefined,
      defaultGuildId: undefined,
    });
  }

  return token;
};

// --- Non-interactive settings operations ---

export const resolveTokenNonInteractive = (
  cliToken: string | undefined,
  configResult: Awaited<ReturnType<typeof loadConfig>>
): Result<string, Error> => {
  if (cliToken) {
    return Result.ok(cliToken);
  }
  if (configResult.isOk()) {
    return Result.ok(configResult.value.token);
  }
  return Result.err(
    new Error("No token found. Provide --token or set DISCORD_BOT_TOKEN.")
  );
};

export const showSettingsNonInteractive = (state: AppState): void => {
  process.stdout.write(
    JSON.stringify(
      {
        token: state.token ? `***${state.token.slice(-6)}` : null,
        clientId: state.clientId ?? null,
        defaultGuildId: state.defaultGuildId ?? null,
      },
      null,
      2
    )
  );
  process.stdout.write("\n");
};

export const setSettingNonInteractive = async (
  key: string,
  value: string,
  state: AppState
): Promise<void> => {
  if (key === "token") {
    state.token = value;
  } else if (key === "client-id") {
    state.clientId = value;
  } else if (key === "guild") {
    state.defaultGuildId = value;
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

export const showInviteLinkNonInteractive = (
  clientId: string | undefined
): void => {
  if (!clientId) {
    process.stderr.write(
      "Error: Client ID required. Use --client-id or set DISCORD_CLIENT_ID.\n"
    );
    process.exit(1);
  }
  process.stdout.write(`${generateInviteLink(clientId)}\n`);
};
