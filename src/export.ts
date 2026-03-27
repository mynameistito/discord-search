import { Result } from "better-result";
import type { CollatedData } from "@/collate.ts";
import { ExportError } from "@/errors.ts";

const escapeCsvField = (value: string): string => {
  if (
    value.includes(",") ||
    value.includes('"') ||
    value.includes("\n") ||
    value.includes("\r")
  ) {
    return `"${value.replace(/"/g, '""')}"`;
  }
  return value;
};

const toCsvRow = (fields: string[]): string =>
  fields.map(escapeCsvField).join(",");

export const exportJson = async (
  data: CollatedData,
  filePath: string
): Promise<Result<void, ExportError>> => {
  return await Result.tryPromise({
    try: async () => {
      const { messages: _messages, ...summary } = data;
      const output = {
        ...summary,
        messages: data.messages.map((msg) => ({
          id: msg.id,
          channel_id: msg.channel_id,
          author: msg.author,
          content: msg.content,
          timestamp: msg.timestamp,
          embeds: msg.embeds,
          attachments: msg.attachments,
        })),
      };
      await Bun.write(filePath, JSON.stringify(output, null, 2));
    },
    catch: (cause) =>
      new ExportError({
        message: `Failed to export JSON: ${cause instanceof Error ? cause.message : String(cause)}`,
        cause,
      }),
  });
};

export const exportMessagesCsv = async (
  data: CollatedData,
  filePath: string
): Promise<Result<void, ExportError>> => {
  return await Result.tryPromise({
    try: async () => {
      const headers = [
        "message_id",
        "channel_id",
        "timestamp",
        "author_id",
        "author_username",
        "author_is_bot",
        "content",
        "embed_count",
        "attachment_count",
      ];

      const rows = [toCsvRow(headers)];

      for (const msg of data.messages) {
        rows.push(
          toCsvRow([
            msg.id,
            msg.channel_id,
            msg.timestamp,
            msg.author.id,
            msg.author.username,
            String(msg.author.bot ?? false),
            msg.content,
            String(msg.embeds?.length ?? 0),
            String(msg.attachments?.length ?? 0),
          ])
        );
      }

      await Bun.write(filePath, rows.join("\n"));
    },
    catch: (cause) =>
      new ExportError({
        message: `Failed to export messages CSV: ${cause instanceof Error ? cause.message : String(cause)}`,
        cause,
      }),
  });
};

export const exportEmbedsCsv = async (
  data: CollatedData,
  filePath: string
): Promise<Result<void, ExportError>> => {
  return await Result.tryPromise({
    try: async () => {
      const headers = [
        "message_id",
        "channel_id",
        "timestamp",
        "author_id",
        "author_username",
        "embed_type",
        "embed_title",
        "embed_description",
        "embed_url",
        "embed_provider",
        "embed_author",
        "field_count",
      ];

      const rows = [toCsvRow(headers)];

      for (const entry of data.embeds) {
        rows.push(
          toCsvRow([
            entry.messageId,
            entry.channelId,
            entry.messageTimestamp,
            entry.messageAuthor.id,
            entry.messageAuthor.username,
            entry.embed.type ?? "",
            entry.embed.title ?? "",
            entry.embed.description ?? "",
            entry.embed.url ?? "",
            entry.embed.provider?.name ?? "",
            entry.embed.author?.name ?? "",
            String(entry.embed.fields?.length ?? 0),
          ])
        );
      }

      await Bun.write(filePath, rows.join("\n"));
    },
    catch: (cause) =>
      new ExportError({
        message: `Failed to export embeds CSV: ${cause instanceof Error ? cause.message : String(cause)}`,
        cause,
      }),
  });
};

export const exportFieldsCsv = async (
  data: CollatedData,
  filePath: string
): Promise<Result<void, ExportError>> => {
  return await Result.tryPromise({
    try: async () => {
      // Collect all unique field names across all extracted fields
      const fieldNames = new Set<string>();
      for (const row of data.extractedFields) {
        for (const name of Object.keys(row.fields)) {
          fieldNames.add(name);
        }
      }

      const sortedFieldNames = [...fieldNames].sort();

      const headers = [
        "message_id",
        "channel_id",
        "timestamp",
        "embed_title",
        "embed_description",
        ...sortedFieldNames,
      ];

      const rows = [toCsvRow(headers)];

      for (const row of data.extractedFields) {
        rows.push(
          toCsvRow([
            row.messageId,
            row.channelId,
            row.messageTimestamp,
            row.embedTitle ?? "",
            row.embedDescription ?? "",
            ...sortedFieldNames.map((name) => row.fields[name] ?? ""),
          ])
        );
      }

      await Bun.write(filePath, rows.join("\n"));
    },
    catch: (cause) =>
      new ExportError({
        message: `Failed to export fields CSV: ${cause instanceof Error ? cause.message : String(cause)}`,
        cause,
      }),
  });
};
