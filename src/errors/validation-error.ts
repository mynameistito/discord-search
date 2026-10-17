import { TaggedError } from "better-result";
import type { z } from "zod";

const defineTaggedError = TaggedError;

/** Error returned when a Discord response fails schema validation. */
export class ValidationError extends defineTaggedError("ValidationError")<{
  issues: z.core.$ZodIssue[];
  message: string;
}> {}
