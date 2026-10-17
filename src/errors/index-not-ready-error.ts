import { TaggedError } from "better-result";

const defineTaggedError = TaggedError;

/** Error returned while Discord is still indexing search results. */
export class IndexNotReadyError extends defineTaggedError(
  "IndexNotReadyError"
)<{
  message: string;
  retryAfter: number;
}> {}
