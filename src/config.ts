import { chmod, readFile, writeFile } from "node:fs/promises";

import { Config as Env, Effect, Option, Redacted, Schema } from "effect";

import { ConfigError, ExportError } from "@/errors.ts";
import { ensureAppDir, SETTINGS_FILE } from "@/paths.ts";

const SettingsSchema = Schema.Struct({
  clientId: Schema.String.pipe(Schema.optional, Schema.mutableKey),
  guildId: Schema.String.pipe(Schema.optional, Schema.mutableKey),
  token: Schema.String.pipe(Schema.optional, Schema.mutableKey),
});

const emptySettings: SettingsJson = {};

const SettingsText = Schema.fromJsonString(SettingsSchema);

/** Configuration required to make authenticated Discord requests. */
export type Config = {
  clientId: string | undefined;
  defaultGuildId: string | undefined;
  token: string;
};

/** Settings persisted by the CLI. */
export type SettingsJson = typeof SettingsSchema.Type;

const readSettingsFile = Effect.fn("Settings.read")(
  function* readSettingsFile() {
    const text = yield* Effect.tryPromise({
      try: async () => await readFile(SETTINGS_FILE, "utf-8"),
      catch: (error) => error,
    }).pipe(
      Effect.catchIf(
        (error) =>
          error instanceof Error && "code" in error && error.code === "ENOENT",
        () => Effect.succeed("{}")
      )
    );

    return yield* Schema.decodeUnknownEffect(SettingsText)(text).pipe(
      Effect.orElseSucceed(() => emptySettings)
    );
  }
);

/** Resolve settings from disk and environment variables. */
export const loadConfig = Effect.fn("Settings.load")(function* loadConfig() {
  const settings = yield* readSettingsFile().pipe(
    Effect.mapError(
      (cause) =>
        new ConfigError({
          message: `Failed to read settings: ${cause instanceof Error ? cause.message : String(cause)}`,
        })
    )
  );

  const { tokenEnv, clientId, guildId } = yield* Env.all({
    tokenEnv: Env.option(Env.Redacted("DISCORD_BOT_TOKEN")),
    clientId: Env.option(Env.String("DISCORD_CLIENT_ID")),
    guildId: Env.option(Env.String("DISCORD_GUILD_ID")),
  }).pipe(
    Effect.mapError(
      () =>
        new ConfigError({
          message: "Failed to read Discord environment configuration",
        })
    )
  );

  const token = Option.match(tokenEnv, {
    onNone: () => settings.token,
    onSome: Redacted.value,
  });

  if (token === undefined || token.length === 0) {
    return yield* new ConfigError({
      message:
        "DISCORD_BOT_TOKEN is not set. Set it via environment variable or run the app to save settings to ~/.discord-search/settings.json.",
    });
  }

  return {
    clientId: Option.getOrUndefined(clientId) ?? settings.clientId,
    defaultGuildId: Option.getOrUndefined(guildId) ?? settings.guildId,
    token,
  };
});

/** Validate, merge, and persist settings with owner-only permissions. */
export const saveSettings = Effect.fn("Settings.save")(function* saveSettings(
  values: SettingsJson
) {
  const validated = yield* Schema.decodeUnknownEffect(SettingsSchema)(
    values
  ).pipe(
    Effect.mapError(
      (cause) =>
        new ExportError({
          cause,
          message: `Invalid settings data: ${cause.message}`,
        })
    )
  );

  yield* Effect.tryPromise({
    try: async () => {
      await ensureAppDir();
    },
    catch: (cause) =>
      new ExportError({
        cause,
        message: `Failed to save settings: ${cause instanceof Error ? cause.message : String(cause)}`,
      }),
  });

  const existing = yield* readSettingsFile().pipe(
    Effect.mapError(
      (cause) =>
        new ExportError({
          cause,
          message: `Failed to save settings: ${cause instanceof Error ? cause.message : String(cause)}`,
        })
    )
  );

  const merged = { ...existing, ...validated };

  yield* Effect.tryPromise({
    try: async () => {
      await writeFile(SETTINGS_FILE, `${JSON.stringify(merged, null, 2)}\n`, {
        mode: 0o600,
      });
    },
    catch: (cause) =>
      new ExportError({
        cause,
        message: `Failed to save settings: ${cause instanceof Error ? cause.message : String(cause)}`,
      }),
  });

  yield* Effect.tryPromise({
    try: async () => {
      await chmod(SETTINGS_FILE, 0o600);
    },
    catch: (cause) => cause,
  }).pipe(
    Effect.catchIf(
      (error) =>
        error instanceof Error &&
        "code" in error &&
        (error.code === "ENOTSUP" || error.code === "EINVAL"),
      () => Effect.void
    ),
    Effect.mapError(
      (cause) =>
        new ExportError({
          cause,
          message: `Failed to secure settings file permissions: ${cause instanceof Error ? cause.message : String(cause)}`,
        })
    )
  );
});

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
export const generateInviteLink = (clientId: string) =>
  `https://discord.com/oauth2/authorize?client_id=${encodeURIComponent(clientId)}&scope=bot&permissions=${BOT_PERMISSIONS}`;
