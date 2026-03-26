import { access, mkdir, readFile, writeFile } from "node:fs/promises";
import { dirname } from "node:path";

export const readTextFile = async (path: string): Promise<string> => {
  return await readFile(path, "utf-8");
};

export const readJsonFile = async <T>(path: string): Promise<T> => {
  const text = await readFile(path, "utf-8");
  return JSON.parse(text) as T;
};

export const fileExists = async (path: string): Promise<boolean> => {
  try {
    await access(path);
    return true;
  } catch {
    return false;
  }
};

export const writeTextFile = async (
  path: string,
  content: string
): Promise<void> => {
  await mkdir(dirname(path), { recursive: true });
  await writeFile(path, content, "utf-8");
};
