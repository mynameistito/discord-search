import { Schema } from "effect";

const taggedError = Schema.TaggedError;

/** Error returned when reading or writing a search preset fails. */
export class PresetError extends taggedError<PresetError>()("PresetError", {
  cause: Schema.Unknown,
  message: Schema.String,
}) {}
