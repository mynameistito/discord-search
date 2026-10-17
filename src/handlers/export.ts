import { mkdir } from "node:fs/promises";

import { select, spinner, text } from "@clack/prompts";
import type { Result } from "better-result";

import { handleCancel, parseTextPrompt } from "@/cli/prompts.ts";
import type { collateResults } from "@/collate.ts";
import type { ExportError } from "@/errors.ts";
import {
  exportEmbedsCsv,
  exportFieldsCsv,
  exportJson,
  exportMessagesCsv,
} from "@/export.ts";
import { OUTPUT_DIR } from "@/paths.ts";

const EXPORT_FORMATS = {
  all: "all",
  csvEmbeds: "csv-embeds",
  csvFields: "csv-fields",
  csvMessages: "csv-messages",
  json: "json",
} as const;

const VALID_EXPORT_FORMATS = new Set<string>(Object.values(EXPORT_FORMATS));

type ExportFormat = (typeof EXPORT_FORMATS)[keyof typeof EXPORT_FORMATS];

const isExportFormat = (value: string): value is ExportFormat =>
  VALID_EXPORT_FORMATS.has(value);

/**
 * Export all requested formats without prompting.
 *
 * @param data - Collated search results.
 * @param guildId - Guild whose messages were searched.
 * @param format - Requested export format.
 * @param outputDir - Optional export destination.
 * @returns The directory containing the exported files.
 */
export const exportNonInteractive = async (
  data: ReturnType<typeof collateResults>,
  guildId: string,
  format: string,
  outputDir?: string
): Promise<string> => {
  if (!isExportFormat(format)) {
    throw new Error(
      `Invalid export format: "${format}". Valid formats: ${[...VALID_EXPORT_FORMATS].join(", ")}`
    );
  }

  const timestamp = new Date().toISOString().replaceAll(/[:.]/gu, "-");
  const dir = outputDir ?? `${OUTPUT_DIR}/${guildId}-${timestamp}`;

  await mkdir(dir, { recursive: true });

  const exports: Promise<Result<void, ExportError>>[] = [];

  if (format === EXPORT_FORMATS.json || format === EXPORT_FORMATS.all) {
    exports.push(exportJson(data, `${dir}/data.json`));
  }

  if (format === EXPORT_FORMATS.csvMessages || format === EXPORT_FORMATS.all) {
    exports.push(exportMessagesCsv(data, `${dir}/messages.csv`));
  }

  if (format === EXPORT_FORMATS.csvEmbeds || format === EXPORT_FORMATS.all) {
    exports.push(exportEmbedsCsv(data, `${dir}/embeds.csv`));
  }

  if (format === EXPORT_FORMATS.csvFields || format === EXPORT_FORMATS.all) {
    exports.push(exportFieldsCsv(data, `${dir}/fields.csv`));
  }

  const results = await Promise.all(exports);
  const failed = results.find((r) => r.isErr());

  if (failed) {
    throw failed.error;
  }

  return dir;
};

/**
 * Prompt for export options and write the selected output files.
 *
 * @param data - Collated search results.
 * @param guildId - Guild whose messages were searched.
 */
export const handleExport = async (
  data: ReturnType<typeof collateResults>,
  guildId: string
): Promise<void> => {
  const format = await select({
    message: "Export format:",
    options: [
      { label: "JSON (full data)", value: EXPORT_FORMATS.json },
      { label: "CSV - Messages", value: EXPORT_FORMATS.csvMessages },
      { label: "CSV - Embeds", value: EXPORT_FORMATS.csvEmbeds },
      { label: "CSV - Extracted Fields", value: EXPORT_FORMATS.csvFields },
      { label: "All of the above", value: EXPORT_FORMATS.all },
      { label: "None (just view summary)", value: "none" },
    ],
  });

  handleCancel(format);

  if (format === "none") {
    return;
  }

  const timestamp = new Date().toISOString().replaceAll(/[:.]/gu, "-");
  const defaultDir = `${OUTPUT_DIR}/${guildId}-${timestamp}`;

  const outputDir = await text({
    initialValue: defaultDir,
    message: "Output directory:",
  });

  const dir = parseTextPrompt(outputDir);

  const s = spinner();
  s.start("Exporting...");

  // Ensure directory exists
  await mkdir(dir, { recursive: true });

  const exports: Promise<Result<void, ExportError>>[] = [];

  if (format === EXPORT_FORMATS.json || format === EXPORT_FORMATS.all) {
    exports.push(exportJson(data, `${dir}/data.json`));
  }

  if (format === EXPORT_FORMATS.csvMessages || format === EXPORT_FORMATS.all) {
    exports.push(exportMessagesCsv(data, `${dir}/messages.csv`));
  }

  if (format === EXPORT_FORMATS.csvEmbeds || format === EXPORT_FORMATS.all) {
    exports.push(exportEmbedsCsv(data, `${dir}/embeds.csv`));
  }

  if (format === EXPORT_FORMATS.csvFields || format === EXPORT_FORMATS.all) {
    exports.push(exportFieldsCsv(data, `${dir}/fields.csv`));
  }

  const results = await Promise.all(exports);
  const failed = results.find((r) => r.isErr());

  if (failed) {
    s.stop(`Export failed: ${failed.error.message}`);

    return;
  }

  s.stop(`Exported to ${dir}/`);
};
