/** Split a comma-separated string into trimmed, non-empty tokens. */
export const parseCommaSeparated = (input: string): string[] =>
  input
    .split(",")
    .map((s) => s.trim())
    .filter(Boolean);
