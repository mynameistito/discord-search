import { TaggedError } from "better-result";

const defineTaggedError = TaggedError;

/** Error returned when reading or writing a search preset fails. */
export class PresetError extends defineTaggedError("PresetError")<{
  cause: unknown;
  message: string;
}> {}
