import { TaggedError } from "better-result";

export class ConfigError extends TaggedError("ConfigError")<{
  message: string;
}>() {}

export class DiscordApiError extends TaggedError("DiscordApiError")<{
  message: string;
  status: number;
  body: unknown;
}>() {}

export class RateLimitExhaustedError extends TaggedError(
  "RateLimitExhaustedError"
)<{
  message: string;
  retryAfter: number;
}>() {}

export class IndexNotReadyError extends TaggedError("IndexNotReadyError")<{
  message: string;
  retryAfter: number;
}>() {}

export class ValidationError extends TaggedError("ValidationError")<{
  message: string;
  issues: unknown;
}>() {}

export class ExportError extends TaggedError("ExportError")<{
  message: string;
  cause: unknown;
}>() {}
