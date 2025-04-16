import path from "path";
import { describe, it, expect, vi } from "vitest";
import { createRelativeImportPath, toPosixPath } from "./path-utils";

describe("createRelativeImportPath", () => {
  it("should return a relative path between two files", () => {
    const outputFile = "/project/src/components/Button.js";
    const inputFile = "/project/src/utils/helpers.ts";

    const result = createRelativeImportPath(outputFile, inputFile);
    expect(result).toBe("../utils/helpers");
  });

  it("should handle same directory paths", () => {
    const outputFile = "/project/src/components/Button.ts";
    const inputFile = "/project/src/components/Modal.ts";

    const result = createRelativeImportPath(outputFile, inputFile);
    expect(result).toBe("./Modal");
  });

  it("should handle deeper directory structures", () => {
    const outputFile = "/project/src/views/dashboard/index.tsx";
    const inputFile = "/project/src/utils/api.ts";

    const result = createRelativeImportPath(outputFile, inputFile);
    expect(result).toBe("../../utils/api");
  });

  it("should normalize Windows-style backslashes", () => {
    const winRelative = path.win32.relative;
    const winDirname = path.win32.dirname;
    vi.spyOn(path, "relative").mockImplementation((from, to) => {
      return winRelative(from, to);
    });
    vi.spyOn(path, "dirname").mockImplementation((path) => {
      return winDirname(path);
    });

    const outputFile = "C:\\project\\src\\components\\Button.ts";
    const inputFile = "C:\\project\\src\\utils\\helpers.ts";

    const result = createRelativeImportPath(outputFile, inputFile);
    expect(result).toBe("../utils/helpers");
  });
});

describe("toPosixPath", () => {
  it("converts backslashes to forward slashes", () => {
    expect(toPosixPath("foo\\bar\\baz")).toBe("foo/bar/baz");
  });

  it("returns the same string if there are no backslashes", () => {
    expect(toPosixPath("foo/bar/baz")).toBe("foo/bar/baz");
  });

  it("handles empty string", () => {
    expect(toPosixPath("")).toBe("");
  });

  it("handles mixed slashes", () => {
    expect(toPosixPath("foo/bar\\baz")).toBe("foo/bar/baz");
  });

  it("handles repeated backslashes", () => {
    expect(toPosixPath("foo\\\\bar\\\\baz")).toBe("foo//bar//baz");
  });
});
