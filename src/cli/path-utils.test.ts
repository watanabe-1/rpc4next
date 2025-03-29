import path from "path";
import { describe, it, expect, vi, afterEach } from "vitest";
import { createRelativeImportPath } from "./path-utils";

describe("createRelativeImportPath", () => {
  afterEach(() => {
    vi.restoreAllMocks();
  });

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
    vi.spyOn(path, "relative").mockImplementation((from, to) => {
      return winRelative(from, to);
    });

    const outputFile = "C:\\project\\src\\components\\Button.ts";
    const inputFile = "C:\\project\\src\\utils\\helpers.ts";

    const result = createRelativeImportPath(outputFile, inputFile);
    expect(result).toBe("../utils/helpers");
  });
});
