import { TaggedError } from "better-result";

const defineTaggedError = TaggedError;

/** Error returned when Discord rate-limit retries are exhausted. */
export class RateLimitExhaustedError extends defineTaggedError(
  "RateLimitExhaustedError"
)<{
  message: string;
  retryAfter: number;
}> {}
