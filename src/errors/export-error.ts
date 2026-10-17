import { TaggedError } from "better-result";

const defineTaggedError = TaggedError;

/** Error returned when exporting data fails. */
export class ExportError extends defineTaggedError("ExportError")<{
  cause: unknown;
  message: string;
}> {}
