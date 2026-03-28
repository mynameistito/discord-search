import { TaggedError } from "better-result";
import type { ZodIssue } from "zod";

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
  issues: ZodIssue[];
}>() {}

export class ExportError extends TaggedError("ExportError")<{
  message: string;
  cause: unknown;
}>() {}

export class PresetError extends TaggedError("PresetError")<{
  message: string;
  cause: unknown;
}>() {}
