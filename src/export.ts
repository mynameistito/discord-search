import { writeFile } from "node:fs/promises";

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
    return `"${value.replaceAll('"', '""')}"`;
  }

  return value;
};

const toCsvRow = (fields: string[]): string =>
  fields.map(escapeCsvField).join(",");

/**
 * Export collated search data as a formatted JSON file.
 *
 * @param data - Collated search results.
 * @param filePath - Destination file path.
 * @returns Success or an export error.
 */
export const exportJson = async (
  data: CollatedData,
  filePath: string
): Promise<Result<void, ExportError>> =>
  await Result.tryPromise({
    catch: (cause) =>
      new ExportError({
        cause,
        message: `Failed to export JSON: ${cause instanceof Error ? cause.message : String(cause)}`,
      }),
    try: async () => {
      const { messages, ...summary } = data;

      const output = {
        ...summary,
        messages: messages.map((msg) => ({
          attachments: msg.attachments,
          author: msg.author,
          channel_id: msg.channel_id,
          content: msg.content,
          embeds: msg.embeds,
          id: msg.id,
          timestamp: msg.timestamp,
        })),
      };

      await writeFile(filePath, JSON.stringify(output, null, 2));
    },
  });

/**
 * Export messages as a CSV file.
 *
 * @param data - Collated search results.
 * @param filePath - Destination file path.
 * @returns Success or an export error.
 */
export const exportMessagesCsv = async (
  data: CollatedData,
  filePath: string
): Promise<Result<void, ExportError>> =>
  await Result.tryPromise({
    catch: (cause) =>
      new ExportError({
        cause,
        message: `Failed to export messages CSV: ${cause instanceof Error ? cause.message : String(cause)}`,
      }),
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

      await writeFile(filePath, `${rows.join("\n")}\n`);
    },
  });

/**
 * Export embeds as a CSV file.
 *
 * @param data - Collated search results.
 * @param filePath - Destination file path.
 * @returns Success or an export error.
 */
export const exportEmbedsCsv = async (
  data: CollatedData,
  filePath: string
): Promise<Result<void, ExportError>> =>
  await Result.tryPromise({
    catch: (cause) =>
      new ExportError({
        cause,
        message: `Failed to export embeds CSV: ${cause instanceof Error ? cause.message : String(cause)}`,
      }),
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

      await writeFile(filePath, `${rows.join("\n")}\n`);
    },
  });

/**
 * Export extracted embed fields as a CSV file.
 *
 * @param data - Collated search results.
 * @param filePath - Destination file path.
 * @returns Success or an export error.
 */
export const exportFieldsCsv = async (
  data: CollatedData,
  filePath: string
): Promise<Result<void, ExportError>> =>
  await Result.tryPromise({
    catch: (cause) =>
      new ExportError({
        cause,
        message: `Failed to export fields CSV: ${cause instanceof Error ? cause.message : String(cause)}`,
      }),
    try: async () => {
      // Collect all unique field names across all extracted fields
      const fieldNames = new Set<string>();

      for (const row of data.extractedFields) {
        for (const name of Object.keys(row.fields)) {
          fieldNames.add(name);
        }
      }

      const sortedFieldNames = [...fieldNames].toSorted();

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

      await writeFile(filePath, `${rows.join("\n")}\n`);
    },
  });
