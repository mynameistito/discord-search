import { mkdir } from "node:fs/promises";
import { homedir } from "node:os";
import { join } from "node:path";
import { fileExists, writeTextFile } from "@/fs.ts";

export const APP_DIR = join(homedir(), ".discord-search");
export const SETTINGS_FILE = join(APP_DIR, "settings.json");
export const OUTPUT_DIR = join(APP_DIR, "output");

export const ensureAppDir = async (): Promise<void> => {
  await mkdir(APP_DIR, { recursive: true });

  const gitignorePath = join(APP_DIR, ".gitignore");
  if (!(await fileExists(gitignorePath))) {
    await writeTextFile(gitignorePath, "*\n");
  }
};
