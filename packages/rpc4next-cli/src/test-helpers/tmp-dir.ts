import fs from "node:fs";
import os from "node:os";
import path from "node:path";

export type FsTree = string | FsTreeDirectory;

export interface FsTreeDirectory {
  [name: string]: FsTree;
}

export const makeTempDir = (prefix = "rpc4next-test-") =>
  fs.mkdtempSync(path.join(os.tmpdir(), prefix));

export const cleanupTempDir = (dir: string | null | undefined) => {
  if (!dir) return;

  fs.rmSync(dir, { recursive: true, force: true });
};

const writeEntry = (targetPath: string, value: FsTree) => {
  if (typeof value === "string") {
    fs.mkdirSync(path.dirname(targetPath), { recursive: true });
    fs.writeFileSync(targetPath, value, "utf8");

    return;
  }

  fs.mkdirSync(targetPath, { recursive: true });

  for (const [name, child] of Object.entries(value)) {
    writeEntry(path.join(targetPath, name), child);
  }
};

export const writeTree = (rootDir: string, tree: Record<string, FsTree>) => {
  fs.mkdirSync(rootDir, { recursive: true });

  for (const [name, value] of Object.entries(tree)) {
    writeEntry(path.join(rootDir, name), value);
  }
};

export const resetTempDir = (rootDir: string, tree: Record<string, FsTree>) => {
  cleanupTempDir(rootDir);
  writeTree(rootDir, tree);
};
