import { mkdir } from "node:fs/promises";
import { select, spinner, text } from "@clack/prompts";
import type { Result } from "better-result";
import { handleCancel } from "@/cli/prompts.ts";
import type { collateResults } from "@/collate.ts";
import type { ExportError } from "@/errors.ts";
import {
  exportEmbedsCsv,
  exportFieldsCsv,
  exportJson,
  exportMessagesCsv,
} from "@/export.ts";
import { OUTPUT_DIR } from "@/paths.ts";

const VALID_EXPORT_FORMATS = new Set([
  "json",
  "csv-messages",
  "csv-embeds",
  "csv-fields",
  "all",
]);

export const exportNonInteractive = async (
  data: ReturnType<typeof collateResults>,
  guildId: string,
  format: string,
  outputDir?: string
): Promise<string> => {
  if (!VALID_EXPORT_FORMATS.has(format)) {
    throw new Error(
      `Invalid export format: "${format}". Valid formats: ${[...VALID_EXPORT_FORMATS].join(", ")}`
    );
  }

  const timestamp = new Date().toISOString().replace(/[:.]/g, "-");
  const dir = outputDir ?? `${OUTPUT_DIR}/${guildId}-${timestamp}`;

  await mkdir(dir, { recursive: true });

  const exports: Promise<Result<void, ExportError>>[] = [];

  if (format === "json" || format === "all") {
    exports.push(exportJson(data, `${dir}/data.json`));
  }
  if (format === "csv-messages" || format === "all") {
    exports.push(exportMessagesCsv(data, `${dir}/messages.csv`));
  }
  if (format === "csv-embeds" || format === "all") {
    exports.push(exportEmbedsCsv(data, `${dir}/embeds.csv`));
  }
  if (format === "csv-fields" || format === "all") {
    exports.push(exportFieldsCsv(data, `${dir}/fields.csv`));
  }

  const results = await Promise.all(exports);
  const failed = results.find((r) => r.isErr());
  if (failed) {
    throw failed.error;
  }

  return dir;
};

export const handleExport = async (
  data: ReturnType<typeof collateResults>,
  guildId: string
): Promise<void> => {
  const format = await select({
    message: "Export format:",
    options: [
      { value: "json", label: "JSON (full data)" },
      { value: "csv-messages", label: "CSV - Messages" },
      { value: "csv-embeds", label: "CSV - Embeds" },
      { value: "csv-fields", label: "CSV - Extracted Fields" },
      { value: "all", label: "All of the above" },
      { value: "none", label: "None (just view summary)" },
    ],
  });
  handleCancel(format);

  if (format === "none") {
    return;
  }

  const timestamp = new Date().toISOString().replace(/[:.]/g, "-");
  const defaultDir = `${OUTPUT_DIR}/${guildId}-${timestamp}`;

  const outputDir = await text({
    message: "Output directory:",
    initialValue: defaultDir,
  });
  handleCancel(outputDir);

  const dir = (outputDir as string).trim();

  const s = spinner();
  s.start("Exporting...");

  // Ensure directory exists
  await mkdir(dir, { recursive: true });

  const exports: Promise<Result<void, ExportError>>[] = [];

  if (format === "json" || format === "all") {
    exports.push(exportJson(data, `${dir}/data.json`));
  }
  if (format === "csv-messages" || format === "all") {
    exports.push(exportMessagesCsv(data, `${dir}/messages.csv`));
  }
  if (format === "csv-embeds" || format === "all") {
    exports.push(exportEmbedsCsv(data, `${dir}/embeds.csv`));
  }
  if (format === "csv-fields" || format === "all") {
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
