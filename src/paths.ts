import { chmod, mkdir, open } from "node:fs/promises";
import { homedir } from "node:os";
import { join } from "node:path";

export const APP_DIR = join(homedir(), ".discord-search");
export const SETTINGS_FILE = join(APP_DIR, "settings.json");
export const PRESETS_FILE = join(APP_DIR, ".discord-search-presets.json");
export const PRESETS_FILE_JSONC = join(
  APP_DIR,
  ".discord-search-presets.jsonc"
);
export const OUTPUT_DIR = join(APP_DIR, "output");

export const getPresetsFile = async (): Promise<string> => {
  try {
    const fh = await open(PRESETS_FILE_JSONC, "r");
    await fh.close();
    return PRESETS_FILE_JSONC;
  } catch (err) {
    if (
      err &&
      typeof err === "object" &&
      "code" in err &&
      err.code === "ENOENT"
    ) {
      return PRESETS_FILE;
    }
    throw err;
  }
};

const chmodSafe = async (path: string, mode: number): Promise<void> => {
  try {
    await chmod(path, mode);
  } catch (err) {
    if (
      err &&
      typeof err === "object" &&
      "code" in err &&
      (err.code === "ENOTSUP" || err.code === "EINVAL")
    ) {
      // Ignore known unsupported cases (e.g., Windows)
    } else {
      throw err;
    }
  }
};

export const ensureAppDir = async (): Promise<void> => {
  await mkdir(APP_DIR, { recursive: true, mode: 0o700 });
  await chmodSafe(APP_DIR, 0o700);

  await mkdir(OUTPUT_DIR, { recursive: true, mode: 0o700 });
  await chmodSafe(OUTPUT_DIR, 0o700);

  const gitignorePath = join(APP_DIR, ".gitignore");
  try {
    const fh = await open(gitignorePath, "wx");
    await fh.writeFile("*\n").finally(() => fh.close());
  } catch (err) {
    if (
      !(
        err &&
        typeof err === "object" &&
        "code" in err &&
        err.code === "EEXIST"
      )
    ) {
      throw err;
    }
  }
};
