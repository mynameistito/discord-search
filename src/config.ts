import { chmod } from "node:fs/promises";
import { Err, Ok, type Result } from "better-result";
import { z } from "zod";
import { ConfigError, ExportError } from "@/errors.ts";
import { ensureAppDir, SETTINGS_FILE } from "@/paths.ts";

const SettingsSchema = z.object({
  token: z.string().optional(),
  guildId: z.string().optional(),
  clientId: z.string().optional(),
});

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
  try {
    const text = await file.text();
    const parsed = JSON.parse(text);

    // Validate with Zod
    const result = SettingsSchema.safeParse(parsed);
    if (!result.success) {
      // Invalid format but recoverable - return empty
      return {};
    }

    return result.data;
  } catch (err) {
    if (err instanceof SyntaxError) {
      // Invalid JSON but recoverable
      return {};
    }
    // Re-throw I/O errors for caller to handle
    throw err;
  }
};

export const loadConfig = async (): Promise<Result<Config, ConfigError>> => {
  let settings: SettingsJson = {};
  try {
    settings = await readSettingsFile();
  } catch (err) {
    // Only swallow ENOENT (file missing)
    if (
      err &&
      typeof err === "object" &&
      "code" in err &&
      err.code === "ENOENT"
    ) {
      // File missing is OK - fall through to env vars
    } else {
      // Other errors (permission, disk, etc.) are real failures
      return new Err(
        new ConfigError({
          message: `Failed to read settings: ${err instanceof Error ? err.message : String(err)}`,
        })
      );
    }
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
    // Validate input before processing
    const validationResult = SettingsSchema.safeParse(values);
    if (!validationResult.success) {
      return new Err(
        new ExportError({
          message: `Invalid settings data: ${validationResult.error.message}`,
          cause: new Error(validationResult.error.message),
        })
      );
    }

    await ensureAppDir();

    let existing: SettingsJson = {};
    try {
      existing = await readSettingsFile();
    } catch (err) {
      // Only swallow ENOENT
      if (
        err &&
        typeof err === "object" &&
        "code" in err &&
        err.code !== "ENOENT"
      ) {
        throw err;
      }
    }

    const merged = { ...existing, ...validationResult.data };

    await Bun.write(SETTINGS_FILE, `${JSON.stringify(merged, null, 2)}\n`);

    // Secure file permissions (owner-only)
    try {
      await chmod(SETTINGS_FILE, 0o600);
    } catch (err) {
      // Only ignore known unsupported cases (e.g., Windows)
      if (
        err &&
        typeof err === "object" &&
        "code" in err &&
        err.code !== "ENOTSUP" &&
        err.code !== "EINVAL"
      ) {
        return new Err(
          new ExportError({
            message: `Failed to secure settings file permissions: ${err instanceof Error ? err.message : String(err)}`,
            cause: err,
          })
        );
      }
    }

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
