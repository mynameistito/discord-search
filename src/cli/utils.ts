export const INTEGER_REGEX = /^\d+$/;

export const parseCommaSeparated = (input: string): string[] | undefined => {
  const trimmed = input.trim();
  if (!trimmed) {
    return;
  }
  return trimmed
    .split(",")
    .map((s) => s.trim())
    .filter(Boolean);
};
