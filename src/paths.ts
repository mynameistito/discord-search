import { chmod, mkdir } from "node:fs/promises";
import { homedir } from "node:os";
import { join } from "node:path";

export const APP_DIR = join(homedir(), ".discord-search");
export const SETTINGS_FILE = join(APP_DIR, "settings.json");
export const OUTPUT_DIR = join(APP_DIR, "output");

export const ensureAppDir = async (): Promise<void> => {
  // Create APP_DIR with owner-only permissions
  await mkdir(APP_DIR, { recursive: true, mode: 0o700 });

  // Ensure permissions are correct (in case directory existed)
  try {
    await chmod(APP_DIR, 0o700);
  } catch {
    // chmod may fail on some systems, but mkdir already set mode
  }

  // Create OUTPUT_DIR with owner-only permissions
  await mkdir(OUTPUT_DIR, { recursive: true, mode: 0o700 });

  // Ensure OUTPUT_DIR permissions are correct
  try {
    await chmod(OUTPUT_DIR, 0o700);
  } catch {
    // chmod may fail on some systems, but mkdir already set mode
  }

  const gitignorePath = join(APP_DIR, ".gitignore");
  const file = Bun.file(gitignorePath);
  if (!(await file.exists())) {
    await Bun.write(gitignorePath, "*\n");
  }
};
