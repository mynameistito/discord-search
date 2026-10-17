type KeyHandler = (key: string) => void;

interface ListenerState {
  cleanup: () => void;
}

/**
 * Listen for raw stdin keys and restore the previous terminal state when stopped.
 *
 * @param onKey - Callback for each non-exit key.
 * @returns A function that removes the listener and restores stdin settings.
 */
export const createKeyListener = (onKey: KeyHandler): (() => void) => {
  if (!process.stdin.isTTY) {
    return () => {
      process.stdin.pause();
    };
  }

  const wasRaw = process.stdin.isRaw;
  const previousEncoding = process.stdin.readableEncoding;
  process.stdin.setRawMode(true);
  process.stdin.resume();
  process.stdin.setEncoding("utf-8");

  const state: ListenerState = {
    cleanup: () => {
      process.stdin.pause();
    },
  };

  const handler = (data: string) => {
    // Ctrl+C — exit
    if (data === "\u0003") {
      state.cleanup();
      process.exit(0);
    }

    onKey(data);
  };

  process.stdin.on("data", handler);

  const cleanup = () => {
    process.stdin.removeListener("data", handler);

    if (!wasRaw) {
      process.stdin.setRawMode(false);
    }

    // Note: Node.js does not support un-setting encoding back to null (raw Buffer mode).
    // If stdin had no encoding before, it remains in "utf8" after cleanup.
    if (previousEncoding !== null) {
      process.stdin.setEncoding(previousEncoding);
    }

    process.stdin.pause();
  };

  state.cleanup = cleanup;

  return cleanup;
};
