import { chmod, mkdir } from "node:fs/promises";
import { homedir } from "node:os";
import { join } from "node:path";

export const APP_DIR = join(homedir(), ".discord-search");
export const SETTINGS_FILE = join(APP_DIR, "settings.json");
export const OUTPUT_DIR = join(APP_DIR, "output");

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
  const file = Bun.file(gitignorePath);
  if (!(await file.exists())) {
    await Bun.write(gitignorePath, "*\n");
  }
};
