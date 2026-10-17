import { chmod, readFile, writeFile } from "node:fs/promises";

import { Err, Ok } from "better-result";
import type { Result } from "better-result";
import { z } from "zod";

import { ConfigError, ExportError } from "@/errors.ts";
import { ensureAppDir, SETTINGS_FILE } from "@/paths.ts";

const SettingsSchema = z.object({
  clientId: z.string().optional(),
  guildId: z.string().optional(),
  token: z.string().optional(),
});

/** Configuration required to make authenticated Discord requests. */
export interface Config {
  clientId: string | undefined;
  defaultGuildId: string | undefined;
  token: string;
}

/** Settings persisted by the CLI. */
export type SettingsJson = z.infer<typeof SettingsSchema>;

const readSettingsFile = async (): Promise<SettingsJson> => {
  let text: string;

  try {
    text = await readFile(SETTINGS_FILE, "utf-8");
  } catch (error) {
    if (error instanceof Error && "code" in error && error.code === "ENOENT") {
      return {};
    }

    throw error;
  }

  try {
    const parsed: unknown = z.unknown().parse(JSON.parse(text));

    // Validate with Zod
    const result = SettingsSchema.safeParse(parsed);

    if (!result.success) {
      // Invalid format but recoverable - return empty
      return {};
    }

    return result.data;
  } catch (error) {
    if (error instanceof SyntaxError) {
      // Invalid JSON but recoverable
      return {};
    }

    // Re-throw I/O errors for caller to handle
    throw error;
  }
};

/**
 * Load settings from disk and environment variables.
 *
 * @returns The resolved config, or a typed configuration error.
 */
export const loadConfig = async (): Promise<Result<Config, ConfigError>> => {
  let settings: SettingsJson;

  try {
    settings = await readSettingsFile();
  } catch (error) {
    return new Err(
      new ConfigError({
        message: `Failed to read settings: ${error instanceof Error ? error.message : String(error)}`,
      })
    );
  }

  const token = process.env.DISCORD_BOT_TOKEN ?? settings.token;

  if (token === undefined || token.length === 0) {
    return new Err(
      new ConfigError({
        message:
          "DISCORD_BOT_TOKEN is not set. Set it via environment variable or run the app to save settings to ~/.discord-search/settings.json.",
      })
    );
  }

  return new Ok({
    clientId: process.env.DISCORD_CLIENT_ID ?? settings.clientId,
    defaultGuildId: process.env.DISCORD_GUILD_ID ?? settings.guildId,
    token,
  });
};

/**
 * Validate, merge, and persist settings with owner-only permissions.
 *
 * @param values - The settings to persist.
 * @returns Success or a typed persistence error.
 */
export const saveSettings = async (
  values: SettingsJson
): Promise<Result<void, ExportError>> => {
  try {
    // Validate input before processing
    const validationResult = SettingsSchema.safeParse(values);

    if (!validationResult.success) {
      return new Err(
        new ExportError({
          cause: new Error(validationResult.error.message),
          message: `Invalid settings data: ${validationResult.error.message}`,
        })
      );
    }

    await ensureAppDir();

    const existing = await readSettingsFile();

    const merged = { ...existing, ...validationResult.data };

    await writeFile(SETTINGS_FILE, `${JSON.stringify(merged, null, 2)}\n`, {
      mode: 0o600,
    });

    // Secure file permissions (owner-only)
    try {
      await chmod(SETTINGS_FILE, 0o600);
    } catch (error) {
      if (
        error instanceof Error &&
        "code" in error &&
        (error.code === "ENOTSUP" || error.code === "EINVAL")
      ) {
        // Ignore known unsupported cases (e.g., Windows)
      } else {
        return new Err(
          new ExportError({
            cause: error,
            message: `Failed to secure settings file permissions: ${error instanceof Error ? error.message : String(error)}`,
          })
        );
      }
    }

    return new Ok(undefined);
  } catch (error) {
    return new Err(
      new ExportError({
        cause: error,
        message: `Failed to save settings: ${error instanceof Error ? error.message : String(error)}`,
      })
    );
  }
};

const BOT_PERMISSION_FLAGS = {
  READ_MESSAGE_HISTORY: 65_536,
  VIEW_CHANNEL: 1024,
} as const;

const BOT_PERMISSIONS = Object.values(BOT_PERMISSION_FLAGS).reduce(
  (total, permission) => total + permission,
  0
);

/** Build a Discord OAuth URL that grants the bot required permissions.
 *
 * @param clientId - Discord application client ID.
 * @returns The bot authorization URL.
 */
export const generateInviteLink = (clientId: string): string =>
  `https://discord.com/oauth2/authorize?client_id=${encodeURIComponent(clientId)}&scope=bot&permissions=${BOT_PERMISSIONS}`;
