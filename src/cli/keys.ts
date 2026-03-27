type KeyHandler = (key: string) => void;

export const createKeyListener = (onKey: KeyHandler): (() => void) => {
  if (!process.stdin.isTTY) {
    return () => {
      // no-op: not a TTY
    };
  }

  const wasRaw = process.stdin.isRaw;
  const previousEncoding = process.stdin.readableEncoding;
  process.stdin.setRawMode(true);
  process.stdin.resume();
  process.stdin.setEncoding("utf8");

  let cleanup: () => void;

  const handler = (data: string) => {
    // Ctrl+C — exit
    if (data === "\x03") {
      cleanup();
      process.exit(0);
    }
    onKey(data);
  };

  process.stdin.on("data", handler);

  cleanup = () => {
    process.stdin.removeListener("data", handler);
    if (!wasRaw) {
      process.stdin.setRawMode(false);
    }
    if (previousEncoding !== null) {
      process.stdin.setEncoding(previousEncoding);
    }
    process.stdin.pause();
  };

  return cleanup;
};
