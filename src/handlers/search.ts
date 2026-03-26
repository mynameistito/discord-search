import { log, select, spinner } from "@clack/prompts";
import { matchError } from "better-result";
import { ANSI_DIM, ANSI_RESET } from "@/cli/ansi.ts";
import { browseMessages } from "@/cli/browser.ts";
import { createKeyListener } from "@/cli/keys.ts";
import { handleCancel } from "@/cli/prompts.ts";
import { collateResults } from "@/collate.ts";
import type { Message, SearchParams } from "@/discord/schemas.ts";
import { searchAllMessages } from "@/discord/search.ts";
import { exportNonInteractive, handleExport } from "@/handlers/export.ts";

export const displaySummary = (
  data: ReturnType<typeof collateResults>
): void => {
  log.info(`Total messages: ${data.totalMessages}`);
  log.info(`Total embeds: ${data.totalEmbeds}`);

  // Top authors
  const authors = Object.entries(data.byAuthor)
    .sort(([, a], [, b]) => b.count - a.count)
    .slice(0, 10);

  if (authors.length > 0) {
    const authorLines = authors
      .map(
        ([id, info]) =>
          `  ${info.username}${info.bot ? " [BOT]" : ""} (${id}): ${info.count}`
      )
      .join("\n");
    log.info(`Top authors:\n${authorLines}`);
  }

  // Embed type breakdown
  if (Object.keys(data.embedsByType).length > 0) {
    const typeLines = Object.entries(data.embedsByType)
      .sort(([, a], [, b]) => b - a)
      .map(([type, count]) => `  ${type}: ${count}`)
      .join("\n");
    log.info(`Embed types:\n${typeLines}`);
  }

  // Top providers
  if (Object.keys(data.embedsByProvider).length > 0) {
    const providerLines = Object.entries(data.embedsByProvider)
      .sort(([, a], [, b]) => b - a)
      .slice(0, 10)
      .map(([provider, count]) => `  ${provider}: ${count}`)
      .join("\n");
    log.info(`Top embed providers:\n${providerLines}`);
  }

  // Top domains
  if (Object.keys(data.embedsByDomain).length > 0) {
    const domainLines = Object.entries(data.embedsByDomain)
      .sort(([, a], [, b]) => b - a)
      .slice(0, 10)
      .map(([domain, count]) => `  ${domain}: ${count}`)
      .join("\n");
    log.info(`Top embed domains:\n${domainLines}`);
  }

  // Extracted field names
  if (data.extractedFields.length > 0) {
    const fieldNames = new Set<string>();
    for (const row of data.extractedFields) {
      for (const name of Object.keys(row.fields)) {
        fieldNames.add(name);
      }
    }
    if (fieldNames.size > 0) {
      log.info(
        `Extracted ${data.extractedFields.length} field rows with columns: ${[...fieldNames].join(", ")}`
      );
    }
  }
};

const handlePostSearch = async (
  collated: ReturnType<typeof collateResults>,
  messages: Message[],
  guildId: string
): Promise<void> => {
  while (true) {
    const action = await select({
      message: "What next?",
      options: [
        {
          value: "browse",
          label: "Browse messages [j/k to navigate, v for JSON]",
        },
        { value: "export", label: "Export results" },
        { value: "done", label: "Done" },
      ],
    });
    handleCancel(action);

    if (action === "done") {
      return;
    }

    if (action === "browse") {
      await browseMessages(messages);
    }

    if (action === "export") {
      await handleExport(collated, guildId);
    }
  }
};

export const executeSearch = async (
  searchParams: SearchParams,
  token: string
): Promise<void> => {
  let liveView = false;
  log.info(
    `${ANSI_DIM}Press [v] during search to toggle live JSON output${ANSI_RESET}`
  );

  const s = spinner();
  s.start("Searching...");

  const cleanupKeys = createKeyListener((key) => {
    if (key === "v") {
      liveView = !liveView;
      s.message(
        liveView ? "Live view ON — streaming results..." : "Live view OFF"
      );
    }
  });

  const result = await searchAllMessages(
    searchParams,
    token,
    (fetched, total) => {
      s.message(
        `Fetching messages... (${fetched.toLocaleString()} / ${total.toLocaleString()})${liveView ? " [LIVE]" : ""}`
      );
    },
    (pageMessages) => {
      if (!liveView) {
        return;
      }
      for (const msg of pageMessages) {
        process.stdout.write(`\n${JSON.stringify(msg)}\n`);
      }
    }
  );

  cleanupKeys();

  if (result.isErr()) {
    s.stop("Search failed.");
    matchError(result.error, {
      DiscordApiError: (e) =>
        log.error(`API error (${e.status}): ${e.message}`),
      RateLimitExhaustedError: (e) =>
        log.error(`Rate limited. Try again in ${e.retryAfter}s.`),
      IndexNotReadyError: (e) =>
        log.error(`Index not ready. Try again in ${e.retryAfter}s.`),
      ValidationError: (e) =>
        log.error(`Response validation failed: ${e.message}`),
    });
    return;
  }

  s.stop(`Found ${result.value.length.toLocaleString()} messages.`);

  if (result.value.length === 0) {
    log.info("No messages matched your search.");
    return;
  }

  const collated = collateResults(result.value);
  displaySummary(collated);
  await handlePostSearch(collated, result.value, searchParams.guildId);
};

export const executeNonInteractiveSearch = async (
  searchParams: SearchParams,
  token: string,
  options: {
    export?: string;
    outputDir?: string;
    json: boolean;
  }
): Promise<void> => {
  const result = await searchAllMessages(
    searchParams,
    token,
    (fetched, total) => {
      process.stderr.write(
        `\rFetching messages... (${fetched.toLocaleString()} / ${total.toLocaleString()})`
      );
    }
  );

  process.stderr.write("\n");

  if (result.isErr()) {
    matchError(result.error, {
      DiscordApiError: (e) =>
        process.stderr.write(`API error (${e.status}): ${e.message}\n`),
      RateLimitExhaustedError: (e) =>
        process.stderr.write(`Rate limited. Try again in ${e.retryAfter}s.\n`),
      IndexNotReadyError: (e) =>
        process.stderr.write(
          `Index not ready. Try again in ${e.retryAfter}s.\n`
        ),
      ValidationError: (e) =>
        process.stderr.write(`Response validation failed: ${e.message}\n`),
    });
    process.exit(1);
  }

  const messages = result.value;
  process.stderr.write(`Found ${messages.length.toLocaleString()} messages.\n`);

  if (messages.length === 0) {
    if (options.json) {
      process.stdout.write('{"totalMessages":0,"messages":[]}\n');
    }
    return;
  }

  const collated = collateResults(messages);

  if (options.json) {
    process.stdout.write(`${JSON.stringify(collated)}\n`);
  }

  if (options.export) {
    const dir = await exportNonInteractive(
      collated,
      searchParams.guildId,
      options.export,
      options.outputDir
    );
    process.stderr.write(`Exported to ${dir}/\n`);
  }

  if (!(options.json || options.export)) {
    displaySummary(collated);
  }
};
