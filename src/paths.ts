import { access, chmod, constants, mkdir, open } from "node:fs/promises";
import { homedir } from "node:os";
import path from "node:path";

export const APP_DIR = path.join(homedir(), ".discord-search");
export const SETTINGS_FILE = path.join(APP_DIR, "settings.json");
export const PRESETS_FILE = path.join(APP_DIR, ".discord-search-presets.json");

export const PRESETS_FILE_JSONC = path.join(
  APP_DIR,
  ".discord-search-presets.jsonc"
);

export const OUTPUT_DIR = path.join(APP_DIR, "output");

/**
 * Resolve the available preset file, preferring the JSONC variant.
 *
 * @returns The path to the existing JSONC or default preset file.
 */
export const getPresetsFile = async (): Promise<string> => {
  try {
    await access(PRESETS_FILE_JSONC, constants.F_OK);

    return PRESETS_FILE_JSONC;
  } catch (error) {
    if (error instanceof Error && "code" in error && error.code === "ENOENT") {
      return PRESETS_FILE;
    }

    throw error;
  }
};

const chmodSafe = async (filePath: string, mode: number): Promise<void> => {
  try {
    await chmod(filePath, mode);
  } catch (error) {
    if (
      error instanceof Error &&
      "code" in error &&
      (error.code === "ENOTSUP" || error.code === "EINVAL")
    ) {
      // Ignore known unsupported cases (e.g., Windows)
    } else {
      throw error;
    }
  }
};

/** Create the application directories and secure the settings directory. */
export const ensureAppDir = async (): Promise<void> => {
  await mkdir(APP_DIR, { mode: 0o700, recursive: true });
  await chmodSafe(APP_DIR, 0o700);

  await mkdir(OUTPUT_DIR, { mode: 0o700, recursive: true });
  await chmodSafe(OUTPUT_DIR, 0o700);

  const gitignorePath = path.join(APP_DIR, ".gitignore");

  try {
    const fh = await open(gitignorePath, "wx");

    try {
      await fh.writeFile("*\n");
    } finally {
      await fh.close();
    }
  } catch (error) {
    if (
      !(error instanceof Error && "code" in error && error.code === "EEXIST")
    ) {
      throw error;
    }
  }
};
