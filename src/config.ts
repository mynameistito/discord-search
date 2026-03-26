import { Err, Ok, type Result } from "better-result";
import { ConfigError, ExportError } from "@/errors.ts";
import { ensureAppDir, SETTINGS_FILE } from "@/paths.ts";

export type Config = {
  clientId: string | undefined;
  defaultGuildId: string | undefined;
  token: string;
};

type SettingsJson = {
  token?: string;
  guildId?: string;
  clientId?: string;
};

const readSettingsFile = async (): Promise<SettingsJson> => {
  const file = Bun.file(SETTINGS_FILE);
  if (!(await file.exists())) {
    return {};
  }
  const text = await file.text();
  return JSON.parse(text) as SettingsJson;
};

export const loadConfig = async (): Promise<Result<Config, ConfigError>> => {
  let settings: SettingsJson = {};
  try {
    settings = await readSettingsFile();
  } catch {
    // Settings file missing or invalid — fall through to env vars
  }

  const token = process.env.DISCORD_BOT_TOKEN ?? settings.token;

  if (!token) {
    return new Err(
      new ConfigError({
        message:
          "DISCORD_BOT_TOKEN is not set. Set it via environment variable or run the app to save settings to ~/.discord-search/settings.json.",
      })
    );
  }

  return new Ok({
    token,
    defaultGuildId: process.env.DISCORD_GUILD_ID ?? settings.guildId,
    clientId: process.env.DISCORD_CLIENT_ID ?? settings.clientId,
  });
};

export const saveSettings = async (
  values: SettingsJson
): Promise<Result<void, ExportError>> => {
  try {
    await ensureAppDir();

    let existing: SettingsJson = {};
    try {
      existing = await readSettingsFile();
    } catch {
      // Start fresh if file is missing or corrupt
    }

    const merged = { ...existing, ...values };

    await Bun.write(SETTINGS_FILE, `${JSON.stringify(merged, null, 2)}\n`);
    return new Ok(undefined);
  } catch (cause) {
    return new Err(
      new ExportError({
        message: `Failed to save settings: ${cause instanceof Error ? cause.message : String(cause)}`,
        cause,
      })
    );
  }
};

const BOT_PERMISSIONS = 66_560; // VIEW_CHANNEL (1024) + READ_MESSAGE_HISTORY (65536)

export const generateInviteLink = (clientId: string): string =>
  `https://discord.com/oauth2/authorize?client_id=${clientId}&scope=bot&permissions=${BOT_PERMISSIONS}`;
