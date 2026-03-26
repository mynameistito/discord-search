#!/usr/bin/env bun

/**
 * Cleanup script to remove temporary files
 * Cross-platform replacement for Unix find command
 */

import type { Dirent } from "node:fs";
import { readdir, unlink } from "node:fs/promises";
import { join } from "node:path";

const TARGET_PATTERNS = [/^tmpclaude-/, /^nul$/];
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

function shouldDeleteFile(filename: string): boolean {
  return TARGET_PATTERNS.some((pattern) => pattern.test(filename));
}

function shouldSkipDir(dirname: string): boolean {
  return SKIP_DIRS.has(dirname);
}

function isFileNotFoundError(error: unknown): error is { code: string } {
  return Boolean(
    error &&
      typeof error === "object" &&
      "code" in error &&
      (error as { code: unknown }).code === "ENOENT"
  );
}

async function readDirectorySafely(dir: string): Promise<Dirent[] | null> {
  try {
    return await readdir(dir, { withFileTypes: true });
  } catch (error) {
    if (isFileNotFoundError(error)) {
      return null;
    }
    throw error;
  }
}

async function deleteFileSafely(fullPath: string): Promise<void> {
  try {
    await unlink(fullPath);
  } catch (error) {
    if (
      error &&
      typeof error === "object" &&
      "code" in error &&
      error.code !== "ENOENT"
    ) {
      console.warn(`Failed to delete file: ${fullPath}`, error);
    }
  }
}

async function processEntry(entry: Dirent, dir: string): Promise<void> {
  const entryName = String(entry.name);
  const fullPath = join(dir, entryName);

  if (entry.isDirectory()) {
    if (!shouldSkipDir(entryName)) {
      await cleanup(fullPath);
    }
  } else if (entry.isFile() && shouldDeleteFile(entryName)) {
    await deleteFileSafely(fullPath);
  }
}

async function cleanup(dir: string): Promise<void> {
  const entries = await readDirectorySafely(dir);
  if (!entries) {
    return;
  }

  for (const entry of entries) {
    await processEntry(entry, dir);
  }
}

(async () => {
  await cleanup(".");
})();
