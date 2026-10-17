export const INTEGER_REGEX = /^\d+$/u;

/**
 * Split a comma-separated string into trimmed values.
 *
 * @param input - The comma-separated input.
 * @returns The trimmed values, or `undefined` for empty input.
 */
export const parseCommaSeparated = (input: string): string[] | undefined => {
  const trimmed = input.trim();

  if (!trimmed) {
    return undefined;
  }

  return trimmed
    .split(",")
    .map((s) => s.trim())
    .filter(Boolean);
};
