import { Schema } from "effect";

const taggedError = Schema.TaggedError;

/** Error returned when exporting data fails. */
export class ExportError extends taggedError<ExportError>()("ExportError", {
  cause: Schema.Unknown,
  message: Schema.String,
}) {}
