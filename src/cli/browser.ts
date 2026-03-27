import {
  ANSI_CLEAR_SCREEN,
  ANSI_CURSOR_HOME,
  ANSI_CYAN,
  ANSI_DIM,
  ANSI_RESET,
  ANSI_YELLOW,
} from "@/cli/ansi.ts";
import { createKeyListener } from "@/cli/keys.ts";
import type { Message } from "@/discord/schemas.ts";

const formatTimestamp = (timestamp: string): string => {
  const date = new Date(timestamp);
  return date.toLocaleString([], {
    year: "numeric",
    month: "short",
    day: "2-digit",
    hour: "2-digit",
    minute: "2-digit",
    hour12: false,
  });
};

const formatMessagePreview = (msg: Message): string => {
  const author = msg.author.bot
    ? `${msg.author.username} [BOT]`
    : msg.author.username;
  const embedCount = msg.embeds?.length ?? 0;
  const attachCount = msg.attachments?.length ?? 0;
  const extras: string[] = [];
  if (embedCount > 0) {
    extras.push(`${embedCount} embed(s)`);
  }
  if (attachCount > 0) {
    extras.push(`${attachCount} attachment(s)`);
  }
  const suffix = extras.length > 0 ? ` [${extras.join(", ")}]` : "";
  const content =
    msg.content.length > 100
      ? `${msg.content.slice(0, 100)}...`
      : msg.content || "(no text content)";
  return `${ANSI_DIM}${formatTimestamp(msg.timestamp)}${ANSI_RESET} ${ANSI_CYAN}${author}${ANSI_RESET}: ${content}${suffix}`;
};

const truncate = (text: string, maxLen: number): string =>
  text.length > maxLen ? `${text.slice(0, maxLen)}...` : text;

const renderField = (field: { name: string; value: string }): void => {
  const name = truncate(field.name, 40);
  const value = truncate(field.value, 100);
  process.stdout.write(`  ${ANSI_CYAN}${name}:${ANSI_RESET} ${value}\n`);
};

const renderEmbedPreview = (msg: Message): void => {
  if (!msg.embeds || msg.embeds.length === 0) {
    return;
  }

  for (const embed of msg.embeds) {
    if (embed.title) {
      const title = truncate(embed.title, 80);
      process.stdout.write(`  Embed: ${title}\n`);
    }
    if (embed.description) {
      const desc = truncate(embed.description, 200);
      process.stdout.write(`  ${ANSI_DIM}${desc}${ANSI_RESET}\n`);
    }
    if (embed.fields) {
      for (const field of embed.fields) {
        renderField(field);
      }
    }
    process.stdout.write("\n");
  }
};

const renderMessageView = (
  msg: Message,
  index: number,
  total: number,
  viewMode: "preview" | "json"
): void => {
  process.stdout.write(ANSI_CLEAR_SCREEN + ANSI_CURSOR_HOME);
  process.stdout.write(
    `${ANSI_YELLOW}Message ${index + 1} of ${total}${ANSI_RESET}\n\n`
  );

  if (viewMode === "json") {
    process.stdout.write(`${JSON.stringify(msg, null, 2)}\n`);
  } else {
    process.stdout.write(`${formatMessagePreview(msg)}\n\n`);
    renderEmbedPreview(msg);
  }

  process.stdout.write(
    `\n${ANSI_DIM}[j/↓] next  [k/↑] prev  [v] toggle JSON  [q/Esc] back${ANSI_RESET}\n`
  );
};

const safeWrite = (text: string): void => {
  process.stdout.write(text);
};

const handleRenderError = (
  err: unknown,
  reject: (reason?: unknown) => void,
  cleanup: () => void
): void => {
  try {
    cleanup();
  } catch {
    // Swallow cleanup errors to preserve original error
  }
  reject(err);
};

const handleQuit = (
  cleanup: () => void,
  resolve: () => void,
  reject: (reason?: unknown) => void
): void => {
  try {
    cleanup();
    safeWrite(ANSI_CLEAR_SCREEN + ANSI_CURSOR_HOME);
    resolve();
  } catch (err) {
    reject(err);
  }
};

const navigate = (
  key: string,
  state: { index: number; viewMode: "preview" | "json" },
  total: number
): void => {
  if (key === "j" || key === "\x1b[B") {
    state.index = Math.min(state.index + 1, total - 1);
  } else if (key === "k" || key === "\x1b[A") {
    state.index = Math.max(state.index - 1, 0);
  } else if (key === "v") {
    state.viewMode = state.viewMode === "preview" ? "json" : "preview";
  }
};

export const browseMessages = (messages: Message[]): Promise<void> => {
  if (!process.stdin.isTTY) {
    safeWrite("Interactive browsing requires a TTY terminal.\n");
    return Promise.resolve();
  }

  return new Promise((resolve, reject) => {
    if (messages.length === 0) {
      try {
        safeWrite(`${ANSI_DIM}No messages to browse.${ANSI_RESET}\n`);
        resolve();
      } catch (err) {
        reject(err);
      }
      return;
    }

    const state = { index: 0, viewMode: "preview" as const };

    let cleanup: () => void = () => {
      // No-op initially, replaced by actual cleanup after first render
    };

    const render = () => {
      const msg = messages[state.index];
      if (!msg) {
        return;
      }
      try {
        renderMessageView(msg, state.index, messages.length, state.viewMode);
      } catch (err) {
        handleRenderError(err, reject, cleanup);
      }
    };

    try {
      render();
    } catch (err) {
      reject(err);
      return;
    }

    cleanup = createKeyListener((key) => {
      if (key === "q" || key === "\x1b") {
        handleQuit(cleanup, resolve, reject);
        return;
      }

      navigate(key, state, messages.length);

      try {
        render();
      } catch (err) {
        handleRenderError(err, reject, cleanup);
      }
    });
  });
};
