export const INTEGER_REGEX = /^\d+$/u;

/**
 * Split a comma-separated string into trimmed values.
 *
 * @param input - The comma-separated input.
 * @returns The trimmed values, or `undefined` for empty input.
 */
export const parseCommaSeparated = (input: string) => {
  const trimmed = input.trim();

  return trimmed
    ? trimmed
        .split(",")
        .map((value) => value.trim())
        .filter(Boolean)
    : undefined;
};
