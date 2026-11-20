import { Schema } from "effect";

const taggedError = Schema.TaggedError;

/** Error returned for failures communicating with Discord. */
export class DiscordApiError extends taggedError<DiscordApiError>()(
  "DiscordApiError",
  {
    body: Schema.Unknown,
    message: Schema.String,
    status: Schema.Number,
  }
) {}
