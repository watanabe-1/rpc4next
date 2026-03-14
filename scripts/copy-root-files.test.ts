import fs from "node:fs";
import os from "node:os";
import path from "node:path";
import { afterEach, describe, expect, it } from "vitest";
import { copyRootFiles, runCli } from "./copy-root-files.js";

const readText = (file: string) => fs.readFileSync(file, "utf8");
const writeText = (file: string, text: string) =>
  fs.writeFileSync(file, text, "utf8");
const mkdirp = (p: string) => fs.mkdirSync(p, { recursive: true });

describe("copyRootFiles", () => {
  let tmpDir: string | null = null;

  afterEach(() => {
    if (tmpDir) fs.rmSync(tmpDir, { recursive: true, force: true });
    tmpDir = null;
  });

  it("copies root files into each package when destination does not exist", () => {
    tmpDir = fs.mkdtempSync(path.join(os.tmpdir(), "rpc4next-test-"));

    const packagesDir = path.join(tmpDir, "packages");
    const pkgA = path.join(packagesDir, "a");
    const pkgB = path.join(packagesDir, "b");
    mkdirp(pkgA);
    mkdirp(pkgB);

    writeText(path.join(tmpDir, "README.md"), "root readme\n");
    writeText(path.join(tmpDir, "LICENSE"), "root license\n");

    const res = copyRootFiles(tmpDir, { fileNames: ["README.md", "LICENSE"] });

    expect(readText(path.join(pkgA, "README.md"))).toBe("root readme\n");
    expect(readText(path.join(pkgB, "README.md"))).toBe("root readme\n");
    expect(readText(path.join(pkgA, "LICENSE"))).toBe("root license\n");
    expect(readText(path.join(pkgB, "LICENSE"))).toBe("root license\n");
    expect(res.copied).toEqual({
      "README.md": ["a", "b"],
      LICENSE: ["a", "b"],
    });
  });

  it("does not overwrite existing package files", () => {
    tmpDir = fs.mkdtempSync(path.join(os.tmpdir(), "rpc4next-test-"));

    const packagesDir = path.join(tmpDir, "packages");
    const pkgA = path.join(packagesDir, "a");
    const pkgB = path.join(packagesDir, "b");
    mkdirp(pkgA);
    mkdirp(pkgB);

    writeText(path.join(tmpDir, "README.md"), "root readme\n");
    writeText(path.join(pkgA, "README.md"), "custom a readme\n");

    const res = copyRootFiles(tmpDir, { fileNames: ["README.md"] });

    expect(readText(path.join(pkgA, "README.md"))).toBe("custom a readme\n");
    expect(readText(path.join(pkgB, "README.md"))).toBe("root readme\n");
    expect(res.copied).toEqual({
      "README.md": ["b"],
    });
  });

  it("supports custom packagesDirName", () => {
    tmpDir = fs.mkdtempSync(path.join(os.tmpdir(), "rpc4next-test-"));

    const modulesDir = path.join(tmpDir, "modules");
    const pkgCore = path.join(modulesDir, "core");
    mkdirp(pkgCore);

    writeText(path.join(tmpDir, "LICENSE"), "root license\n");

    const res = copyRootFiles(tmpDir, {
      packagesDirName: "modules",
      fileNames: ["LICENSE"],
    });

    expect(readText(path.join(pkgCore, "LICENSE"))).toBe("root license\n");
    expect(res.copied).toEqual({
      LICENSE: ["core"],
    });
  });

  it("ignores non-directory entries under packages", () => {
    tmpDir = fs.mkdtempSync(path.join(os.tmpdir(), "rpc4next-test-"));

    const packagesDir = path.join(tmpDir, "packages");
    const pkgA = path.join(packagesDir, "a");
    mkdirp(pkgA);

    writeText(path.join(tmpDir, "README.md"), "root readme\n");
    writeText(path.join(packagesDir, "not-a-package.txt"), "skip me\n");

    const res = copyRootFiles(tmpDir, { fileNames: ["README.md"] });

    expect(readText(path.join(pkgA, "README.md"))).toBe("root readme\n");
    expect(
      fs.existsSync(path.join(packagesDir, "not-a-package.txt", "README.md")),
    ).toBe(false);
    expect(res.copied).toEqual({
      "README.md": ["a"],
    });
  });

  it("runCli copies README.md and LICENSE using provided cwd", () => {
    tmpDir = fs.mkdtempSync(path.join(os.tmpdir(), "rpc4next-test-"));

    const pkg = path.join(tmpDir, "packages", "rpc4next");
    mkdirp(pkg);

    writeText(path.join(tmpDir, "README.md"), "root readme\n");
    writeText(path.join(tmpDir, "LICENSE"), "root license\n");

    const res = runCli(tmpDir);

    expect(readText(path.join(pkg, "README.md"))).toBe("root readme\n");
    expect(readText(path.join(pkg, "LICENSE"))).toBe("root license\n");
    expect(res.copied).toEqual({
      "README.md": ["rpc4next"],
      LICENSE: ["rpc4next"],
    });
  });
});
