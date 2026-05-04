import fs from "node:fs";
import path from "node:path";
import { afterEach, describe, expect, it } from "vitest";

import { cleanupTempDir, makeTempDir, resetTempDir, writeTree } from "./tmp-dir.js";

describe("tmp-dir helpers", () => {
  const createdDirs: string[] = [];

  afterEach(() => {
    while (createdDirs.length > 0) {
      cleanupTempDir(createdDirs.pop());
    }
  });

  it("makeTempDir creates a unique existing directory", () => {
    const dirA = makeTempDir();
    const dirB = makeTempDir();
    createdDirs.push(dirA, dirB);

    expect(dirA).not.toBe(dirB);
    expect(fs.existsSync(dirA)).toBe(true);
    expect(fs.statSync(dirA).isDirectory()).toBe(true);
    expect(fs.existsSync(dirB)).toBe(true);
    expect(fs.statSync(dirB).isDirectory()).toBe(true);
  });

  it("cleanupTempDir ignores nullish input and removes directories recursively", () => {
    expect(() => cleanupTempDir(null)).not.toThrow();
    expect(() => cleanupTempDir(undefined)).not.toThrow();

    const dir = makeTempDir();
    const nestedFile = path.join(dir, "nested", "file.txt");
    createdDirs.push(dir);
    fs.mkdirSync(path.dirname(nestedFile), { recursive: true });
    fs.writeFileSync(nestedFile, "hello", "utf8");

    cleanupTempDir(dir);

    expect(fs.existsSync(dir)).toBe(false);
    createdDirs.pop();
  });

  it("writeTree creates nested directories and files", () => {
    const dir = makeTempDir();
    createdDirs.push(dir);

    writeTree(dir, {
      "root.txt": "root",
      nested: {
        deeper: {
          "child.txt": "child",
        },
      },
    });

    expect(fs.readFileSync(path.join(dir, "root.txt"), "utf8")).toBe("root");
    expect(fs.readFileSync(path.join(dir, "nested", "deeper", "child.txt"), "utf8")).toBe("child");
  });

  it("resetTempDir replaces existing contents with the new tree", () => {
    const dir = makeTempDir();
    createdDirs.push(dir);

    writeTree(dir, {
      old: {
        "stale.txt": "stale",
      },
    });

    resetTempDir(dir, {
      fresh: {
        "next.txt": "next",
      },
    });

    expect(fs.existsSync(path.join(dir, "old", "stale.txt"))).toBe(false);
    expect(fs.readFileSync(path.join(dir, "fresh", "next.txt"), "utf8")).toBe("next");
  });
});
