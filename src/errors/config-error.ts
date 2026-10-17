import { TaggedError } from "better-result";

const defineTaggedError = TaggedError;

/** Error raised when application configuration cannot be loaded. */
export class ConfigError extends defineTaggedError("ConfigError")<{
  message: string;
}> {}
