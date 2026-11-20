import { Schema } from "effect";

const taggedError = Schema.TaggedError;

/** Error raised when application configuration cannot be loaded. */
export class ConfigError extends taggedError<ConfigError>()("ConfigError", {
  message: Schema.String,
}) {}
