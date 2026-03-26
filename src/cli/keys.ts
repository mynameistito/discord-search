type KeyHandler = (key: string) => void;

export const createKeyListener = (onKey: KeyHandler): (() => void) => {
  if (!process.stdin.isTTY) {
    return () => {
      // no-op: not a TTY
    };
  }

  const wasRaw = process.stdin.isRaw;
  process.stdin.setRawMode(true);
  process.stdin.resume();
  process.stdin.setEncoding("utf8");

  const handler = (data: string) => {
    // Ctrl+C — exit
    if (data === "\x03") {
      process.exit(0);
    }
    onKey(data);
  };

  process.stdin.on("data", handler);

  return () => {
    process.stdin.removeListener("data", handler);
    if (!wasRaw) {
      process.stdin.setRawMode(false);
    }
    process.stdin.pause();
  };
};
