import path from "node:path";
import { beforeEach, describe, expect, it } from "vitest";

import {
  clearScanAppDirCacheAbove,
  clearVisitedDirsCacheAbove,
  createScanAppDirCacheKey,
  scanAppDirCache,
  visitedDirsCache,
} from "./cache.js";

describe("clearVisitedDirsCacheAbove", () => {
  beforeEach(() => {
    visitedDirsCache.clear();

    // Setup example entries
    visitedDirsCache.set("/project", true);
    visitedDirsCache.set("/project/src", true);
    visitedDirsCache.set("/project/src/app", true);
    visitedDirsCache.set("/project/src/app/foo", true);
    visitedDirsCache.set("/project/src/app/foo/bar", true);
    visitedDirsCache.set("/project/other", true);
  });

  it("removes target directory and its ancestors", () => {
    clearVisitedDirsCacheAbove("/project/src/app/foo");

    expect(visitedDirsCache.has("/project")).toBe(false);
    expect(visitedDirsCache.has("/project/src")).toBe(false);
    expect(visitedDirsCache.has("/project/src/app")).toBe(false);
    expect(visitedDirsCache.has("/project/src/app/foo")).toBe(false);

    expect(visitedDirsCache.has("/project/src/app/foo/bar")).toBe(true);
    expect(visitedDirsCache.has("/project/other")).toBe(true);
  });

  it("handles trailing slash in target directory", () => {
    clearVisitedDirsCacheAbove("/project/src/app/foo/");

    expect(visitedDirsCache.has("/project")).toBe(false);
    expect(visitedDirsCache.has("/project/src")).toBe(false);
    expect(visitedDirsCache.has("/project/src/app")).toBe(false);
    expect(visitedDirsCache.has("/project/src/app/foo")).toBe(false);

    expect(visitedDirsCache.has("/project/src/app/foo/bar")).toBe(true);
    expect(visitedDirsCache.has("/project/other")).toBe(true);
  });

  it("does not remove anything if no matching ancestor", () => {
    clearVisitedDirsCacheAbove("/not/exist");
    expect(visitedDirsCache.size).toBe(6);
  });

  it("works with relative paths", () => {
    const relativeTarget = "./project/src/app/foo";
    const absoluteTarget = path.resolve(relativeTarget);

    visitedDirsCache.set(absoluteTarget, true);
    visitedDirsCache.set(path.join(absoluteTarget, "subdir"), true);

    clearVisitedDirsCacheAbove(relativeTarget);

    expect(visitedDirsCache.has(absoluteTarget)).toBe(false);
    expect(visitedDirsCache.has(path.join(absoluteTarget, "subdir"))).toBe(true);
  });

  it("removes parent directory and ancestors when given a file path", () => {
    const filePath = "/project/src/app/foo/file.txt";
    clearVisitedDirsCacheAbove(filePath);

    expect(visitedDirsCache.has("/project")).toBe(false);
    expect(visitedDirsCache.has("/project/src")).toBe(false);
    expect(visitedDirsCache.has("/project/src/app")).toBe(false);
    expect(visitedDirsCache.has("/project/src/app/foo")).toBe(false);

    expect(visitedDirsCache.has("/project/src/app/foo/bar")).toBe(true);
    expect(visitedDirsCache.has("/project/other")).toBe(true);
  });

  it("does nothing if file path has no match", () => {
    const filePath = "/non/existent/file.txt";
    const originalSize = visitedDirsCache.size;
    clearVisitedDirsCacheAbove(filePath);
    expect(visitedDirsCache.size).toBe(originalSize);
  });
});

describe("clearScanAppDirCacheAbove", () => {
  beforeEach(() => {
    const blunkObj = {
      pathStructure: "",
      imports: [],
      paramsTypes: [],
    };
    scanAppDirCache.clear();
    scanAppDirCache.set(
      createScanAppDirCacheKey({
        output: "/output",
        input: "/project",
        indent: "",
        rootDir: "/project",
        parentParams: [],
      }),
      blunkObj,
    );
    scanAppDirCache.set(
      createScanAppDirCacheKey({
        output: "/output",
        input: "/project/src",
        indent: "",
        rootDir: "/project",
        parentParams: [],
      }),
      blunkObj,
    );
    scanAppDirCache.set(
      createScanAppDirCacheKey({
        output: "/output",
        input: "/project/src/app",
        indent: "  ",
        rootDir: "/project",
        parentParams: [{ paramName: "id", routeType: { isDynamic: true } }],
      }),
      blunkObj,
    );
    scanAppDirCache.set(
      createScanAppDirCacheKey({
        output: "/output",
        input: "/project/other",
        indent: "",
        rootDir: "/project/other",
        parentParams: [],
      }),
      blunkObj,
    );
  });

  it("removes target directory and its ancestors from scanAppDirCache", () => {
    clearScanAppDirCacheAbove("/project/src/app");

    expect([...scanAppDirCache.keys()].some((key) => key.includes("/project\u0000"))).toBe(false);
    expect([...scanAppDirCache.keys()].some((key) => key.includes("/project/src\u0000"))).toBe(
      false,
    );
    expect([...scanAppDirCache.keys()].some((key) => key.includes("/project/src/app\u0000"))).toBe(
      false,
    );
    expect([...scanAppDirCache.keys()].some((key) => key.includes("/project/other\u0000"))).toBe(
      true,
    );
  });

  it("does nothing if no matching ancestor exists", () => {
    const size = scanAppDirCache.size;
    clearScanAppDirCacheAbove("/no/match");
    expect(scanAppDirCache.size).toBe(size);
  });
});

describe("clearVisitedDirsCacheAbove - additional cases", () => {
  it("does nothing if visitedDirsCache is empty", () => {
    visitedDirsCache.clear();
    clearVisitedDirsCacheAbove("/any/path");
    expect(visitedDirsCache.size).toBe(0);
  });

  it("does not remove entries when target is not related at all", () => {
    visitedDirsCache.clear();
    visitedDirsCache.set("/unrelated/path", true);
    clearVisitedDirsCacheAbove("/totally/different");
    expect(visitedDirsCache.has("/unrelated/path")).toBe(true);
  });

  it("handles root directory correctly", () => {
    visitedDirsCache.clear();
    visitedDirsCache.set("/", true);
    visitedDirsCache.set("/foo", true);
    clearVisitedDirsCacheAbove("/");
    expect(visitedDirsCache.has("/")).toBe(false);
    expect(visitedDirsCache.has("/foo")).toBe(true);
  });

  it("handles directory paths containing '../'", () => {
    visitedDirsCache.clear();
    visitedDirsCache.set("/project/src", true);
    visitedDirsCache.set("/project/src/app", true);
    clearVisitedDirsCacheAbove("/project/src/app/../app");
    expect(visitedDirsCache.has("/project/src")).toBe(false);
    expect(visitedDirsCache.has("/project/src/app")).toBe(false);
  });

  it("does not mistakenly delete similar looking directories", () => {
    visitedDirsCache.clear();
    visitedDirsCache.set("/project/src", true);
    visitedDirsCache.set("/project2/src", true);
    clearVisitedDirsCacheAbove("/project/src/app");
    expect(visitedDirsCache.has("/project/src")).toBe(false);
    expect(visitedDirsCache.has("/project2/src")).toBe(true);
  });
});
