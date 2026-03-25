import { mkdir } from "node:fs/promises";
import { homedir } from "node:os";
import { join } from "node:path";

export const APP_DIR = join(homedir(), ".discord-search");
export const SETTINGS_FILE = join(APP_DIR, "settings.json");
export const OUTPUT_DIR = join(APP_DIR, "output");

export const ensureAppDir = async (): Promise<void> => {
  await mkdir(APP_DIR, { recursive: true });

  const gitignorePath = join(APP_DIR, ".gitignore");
  const file = Bun.file(gitignorePath);
  if (!(await file.exists())) {
    await Bun.write(gitignorePath, "*\n");
  }
};
