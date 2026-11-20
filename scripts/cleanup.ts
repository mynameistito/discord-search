#!/usr/bin/env bun

import { readdir, unlink } from "node:fs/promises";
import path from "node:path";

const TARGET_PATTERNS = [/^tmpclaude-/u, /^nul$/u];

const SKIP_DIRS = new Set([
  "node_modules",
  ".git",
  "dist",
  "build",
  ".next",
  "out",
  "coverage",
  ".turbo",
  ".parcel-cache",
  "typings",
  "generated",
  "build-output",
]);

const shouldDeleteFile = (filename: string) =>
  TARGET_PATTERNS.some((pattern) => pattern.test(filename));

const shouldSkipDir = (dirname: string) => SKIP_DIRS.has(dirname);

const isFileNotFoundError = (error: unknown): error is NodeJS.ErrnoException =>
  error instanceof Error && "code" in error && error.code === "ENOENT";

const readDirectorySafely = async (dir: string) => {
  try {
    return await readdir(dir, { withFileTypes: true });
  } catch (error) {
    if (isFileNotFoundError(error)) {
      return null;
    }

    throw error;
  }
};

const deleteFileSafely = async (fullPath: string) => {
  try {
    await unlink(fullPath);
  } catch (error) {
    if (error instanceof Error && "code" in error && error.code !== "ENOENT") {
      console.warn(`Failed to delete file: ${fullPath}`, error);
    }
  }
};

const cleanup = async (dir: string) => {
  const entries = await readDirectorySafely(dir);

  if (entries === null) {
    return;
  }

  await Promise.all(
    entries.map(async (entry) => {
      const entryName = entry.name;
      const fullPath = path.join(dir, entryName);

      if (entry.isDirectory()) {
        if (!shouldSkipDir(entryName)) {
          await cleanup(fullPath);
        }

        return;
      }

      if (entry.isFile() && shouldDeleteFile(entryName)) {
        await deleteFileSafely(fullPath);
      }
    })
  );
};

await cleanup(".");
