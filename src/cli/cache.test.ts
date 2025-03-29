import path from "path";
import mock from "mock-fs";
import { describe, it, expect, beforeEach, afterEach } from "vitest";
import {
  clearCntCache,
  clearVisitedDirsCacheAbove,
  cntCache,
  visitedDirsCache,
} from "./cache";

describe("clearVisitedDirsCacheAbove - when given a directory path", () => {
  beforeEach(() => {
    // Reset cache before each test
    visitedDirsCache.clear();

    // Example: set up cache entries
    // Ancestors (above the target directory)
    visitedDirsCache.set("/project", true);
    visitedDirsCache.set("/project/src", true);
    visitedDirsCache.set("/project/src/app", true);
    // Target directory and its descendants
    visitedDirsCache.set("/project/src/app/foo", true);
    visitedDirsCache.set("/project/src/app/foo/bar", true);
    // Unrelated entry (should not be affected)
    visitedDirsCache.set("/project/other", true);
  });

  it("should remove the target directory and all its ancestor directories", () => {
    // Target: /project/src/app/foo
    // Expect: /project, /project/src, /project/src/app, and /project/src/app/foo to be removed
    //         /project/src/app/foo/bar should remain
    clearVisitedDirsCacheAbove("/project/src/app/foo");

    expect(visitedDirsCache.has("/project")).toBe(false);
    expect(visitedDirsCache.has("/project/src")).toBe(false);
    expect(visitedDirsCache.has("/project/src/app")).toBe(false);
    expect(visitedDirsCache.has("/project/src/app/foo")).toBe(false);

    // Descendant should not be removed
    expect(visitedDirsCache.has("/project/src/app/foo/bar")).toBe(true);
    // Unrelated entry remains
    expect(visitedDirsCache.has("/project/other")).toBe(true);
  });

  it("should work correctly even if the target directory has a trailing slash", () => {
    clearVisitedDirsCacheAbove("/project/src/app/foo/");

    expect(visitedDirsCache.has("/project")).toBe(false);
    expect(visitedDirsCache.has("/project/src")).toBe(false);
    expect(visitedDirsCache.has("/project/src/app")).toBe(false);
    expect(visitedDirsCache.has("/project/src/app/foo")).toBe(false);

    expect(visitedDirsCache.has("/project/src/app/foo/bar")).toBe(true);
    expect(visitedDirsCache.has("/project/other")).toBe(true);
  });

  it("should not remove anything if the target directory has no matching ancestor in the cache", () => {
    // Non-existent path "/not/exist"
    clearVisitedDirsCacheAbove("/not/exist");

    // None of the 6 pre-registered entries should be affected
    expect(visitedDirsCache.size).toBe(6);
  });

  it("should work correctly with relative paths", () => {
    const relativeTarget = "./project/src/app/foo";
    const absoluteTarget = path.resolve(relativeTarget);

    // Add additional entries
    visitedDirsCache.set(absoluteTarget, true);
    visitedDirsCache.set(path.join(absoluteTarget, "subdir"), true);

    clearVisitedDirsCacheAbove(relativeTarget);

    // Ancestors (resolved as absolute path) should be removed
    expect(visitedDirsCache.has(absoluteTarget)).toBe(false);
    // Descendant should not be removed
    expect(visitedDirsCache.has(path.join(absoluteTarget, "subdir"))).toBe(
      true
    );
  });
});

describe("clearVisitedDirsCacheAbove - when given a file path", () => {
  beforeEach(() => {
    visitedDirsCache.clear();

    // Set up cache entries
    visitedDirsCache.set("/project", true);
    visitedDirsCache.set("/project/src", true);
    visitedDirsCache.set("/project/src/app", true);
    visitedDirsCache.set("/project/src/app/foo", true);
    visitedDirsCache.set("/project/src/app/foo/bar", true);
    visitedDirsCache.set("/project/other", true);

    // Set up mock filesystem
    mock({
      "/project/src/app/foo": {
        "file.txt": "dummy content",
        bar: {},
      },
      "/project": {},
      "/project/other": {},
      "/project/src": {},
      "/project/src/app": {},
    });
  });

  afterEach(() => {
    mock.restore();
  });

  it("should remove the parent directory of the file and all its ancestor directories", () => {
    const filePath = "/project/src/app/foo/file.txt";
    // The target becomes "/project/src/app/foo"
    // Expect: /project, /project/src, /project/src/app, and /project/src/app/foo to be removed
    //         Descendants like /project/src/app/foo/bar should remain
    clearVisitedDirsCacheAbove(filePath);

    expect(visitedDirsCache.has("/project")).toBe(false);
    expect(visitedDirsCache.has("/project/src")).toBe(false);
    expect(visitedDirsCache.has("/project/src/app")).toBe(false);
    expect(visitedDirsCache.has("/project/src/app/foo")).toBe(false);

    expect(visitedDirsCache.has("/project/src/app/foo/bar")).toBe(true);
    expect(visitedDirsCache.has("/project/other")).toBe(true);
  });

  it("should not remove anything if the file does not exist", () => {
    const filePath = "/non/existent/file.txt";
    const originalSize = visitedDirsCache.size;
    clearVisitedDirsCacheAbove(filePath);
    expect(visitedDirsCache.size).toBe(originalSize);
  });
});

describe("clearCntCache", () => {
  // Clear cache before each test
  beforeEach(() => {
    clearCntCache();
  });

  it("should remove all keys from cntCache when populated", () => {
    // Set sample data to cntCache
    cntCache["key1"] = 10;
    cntCache["key2"] = 20;

    // Ensure values are set
    expect(Object.keys(cntCache)).toHaveLength(2);

    // Execute clearCntCache
    clearCntCache();

    // Ensure cntCache is empty
    expect(Object.keys(cntCache)).toHaveLength(0);
  });

  it("should work correctly when cntCache is already empty", () => {
    // Ensure initial state is empty
    expect(Object.keys(cntCache)).toHaveLength(0);

    // Execute clearCntCache without error and still empty
    clearCntCache();
    expect(Object.keys(cntCache)).toHaveLength(0);
  });
});
