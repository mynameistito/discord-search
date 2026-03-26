import { mkdir } from "node:fs/promises";
import { select, spinner, text } from "@clack/prompts";
import { handleCancel } from "@/cli/prompts.ts";
import type { collateResults } from "@/collate.ts";
import {
  exportEmbedsCsv,
  exportFieldsCsv,
  exportJson,
  exportMessagesCsv,
} from "@/export.ts";
import { OUTPUT_DIR } from "@/paths.ts";

export const exportNonInteractive = async (
  data: ReturnType<typeof collateResults>,
  guildId: string,
  format: string,
  outputDir?: string
): Promise<string> => {
  const timestamp = new Date().toISOString().replace(/[:.]/g, "-");
  const dir = outputDir ?? `${OUTPUT_DIR}/${guildId}-${timestamp}`;

  await mkdir(dir, { recursive: true });

  const exports: Promise<unknown>[] = [];

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

  await Promise.all(exports);
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
      { value: "messages", label: "CSV - Messages" },
      { value: "embeds", label: "CSV - Embeds" },
      { value: "fields", label: "CSV - Extracted Fields" },
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

  const exports: Promise<unknown>[] = [];

  if (format === "json" || format === "all") {
    exports.push(exportJson(data, `${dir}/data.json`));
  }
  if (format === "messages" || format === "all") {
    exports.push(exportMessagesCsv(data, `${dir}/messages.csv`));
  }
  if (format === "embeds" || format === "all") {
    exports.push(exportEmbedsCsv(data, `${dir}/embeds.csv`));
  }
  if (format === "fields" || format === "all") {
    exports.push(exportFieldsCsv(data, `${dir}/fields.csv`));
  }

  await Promise.all(exports);

  s.stop(`Exported to ${dir}/`);
};
