import { Schema } from "effect";

const taggedError = Schema.TaggedError;

/** Error returned when Discord rate-limit retries are exhausted. */
export class RateLimitExhaustedError extends taggedError<RateLimitExhaustedError>()(
  "RateLimitExhaustedError",
  {
    message: Schema.String,
    retryAfter: Schema.Number,
  }
) {}
