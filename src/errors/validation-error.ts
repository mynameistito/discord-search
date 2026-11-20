import { Schema } from "effect";

const taggedError = Schema.TaggedError;

/** Error returned when a Discord response fails schema validation. */
export class ValidationError extends taggedError<ValidationError>()(
  "ValidationError",
  {
    message: Schema.String,
  }
) {}
