import { TaggedError } from "better-result";

const defineTaggedError = TaggedError;

/** Error returned for failures communicating with Discord. */
export class DiscordApiError extends defineTaggedError("DiscordApiError")<{
  body: unknown;
  message: string;
  status: number;
}> {}
