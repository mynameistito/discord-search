import {
  ANSI_CLEAR_SCREEN,
  ANSI_CYAN,
  ANSI_DIM,
  ANSI_RESET,
  ANSI_YELLOW,
} from "@/cli/ansi.ts";
import { createKeyListener } from "@/cli/keys.ts";
import type { Message } from "@/discord/schemas.ts";

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
  return `${ANSI_DIM}${msg.timestamp}${ANSI_RESET} ${ANSI_CYAN}${author}${ANSI_RESET}: ${content}${suffix}`;
};

const renderEmbedPreview = (msg: Message): void => {
  if (!msg.embeds || msg.embeds.length === 0) {
    return;
  }

  for (const embed of msg.embeds) {
    if (embed.title) {
      process.stdout.write(`  Embed: ${embed.title}\n`);
    }
    if (embed.description) {
      const desc =
        embed.description.length > 200
          ? `${embed.description.slice(0, 200)}...`
          : embed.description;
      process.stdout.write(`  ${ANSI_DIM}${desc}${ANSI_RESET}\n`);
    }
    if (embed.fields) {
      for (const field of embed.fields) {
        process.stdout.write(
          `  ${ANSI_CYAN}${field.name}:${ANSI_RESET} ${field.value}\n`
        );
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
  process.stdout.write(ANSI_CLEAR_SCREEN);
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
    `\n${ANSI_DIM}[j/↓] next  [k/↑] prev  [v] toggle JSON  [q] back${ANSI_RESET}\n`
  );
};

export const browseMessages = (messages: Message[]): Promise<void> => {
  return new Promise((resolve) => {
    if (messages.length === 0) {
      resolve();
      return;
    }

    let index = 0;
    let viewMode: "preview" | "json" = "preview";

    const render = () => {
      const msg = messages[index];
      if (!msg) {
        return;
      }
      renderMessageView(msg, index, messages.length, viewMode);
    };

    render();

    const cleanup = createKeyListener((key) => {
      if (key === "q" || key === "\x1b") {
        cleanup();
        process.stdout.write(ANSI_CLEAR_SCREEN);
        resolve();
        return;
      }

      if (key === "j" || key === "\x1b[B") {
        index = Math.min(index + 1, messages.length - 1);
      } else if (key === "k" || key === "\x1b[A") {
        index = Math.max(index - 1, 0);
      } else if (key === "v") {
        viewMode = viewMode === "preview" ? "json" : "preview";
      }

      render();
    });
  });
};
