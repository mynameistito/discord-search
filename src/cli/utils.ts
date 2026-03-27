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
