import { Schema } from "effect";

const taggedError = Schema.TaggedError;

/** Error returned while Discord is still indexing search results. */
export class IndexNotReadyError extends taggedError<IndexNotReadyError>()(
  "IndexNotReadyError",
  {
    message: Schema.String,
    retryAfter: Schema.Number,
  }
) {}
