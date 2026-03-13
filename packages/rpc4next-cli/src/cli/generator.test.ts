import fs from "node:fs";
import path from "node:path";
import { beforeEach, describe, expect, it, vi } from "vitest";
import {
  SUCCESS_INDENT_LEVEL,
  SUCCESS_PAD_LENGTH,
  SUCCESS_SEPARATOR,
} from "./constants.js";
import * as generatePathStructure from "./core/generate-path-structure.js";
import { generate } from "./generator.js";
import { padMessage } from "./logger.js";

describe("generate", () => {
  const logger = {
    info: vi.fn(),
    success: vi.fn(),
    error: vi.fn(),
  };

  const baseDir = "test/base";
  const outputPath = "test/output/types.ts";
  const paramsFileName = "params.ts";

  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("writes the output file when it does not exist", () => {
    vi.spyOn(generatePathStructure, "generatePathStructure").mockReturnValue({
      pathStructure: "generated-type-content",
      paramsTypes: [],
    });

    vi.spyOn(fs, "existsSync").mockReturnValue(false);
    vi.spyOn(fs, "readFileSync").mockImplementation(() => "");
    vi.spyOn(fs, "writeFileSync").mockImplementation(() => {});

    generate({
      baseDir,
      outputPath,
      paramsFileName: null,
      logger,
    });

    expect(logger.info).toHaveBeenCalledWith("Generating types...", {
      event: "generate",
    });

    expect(generatePathStructure.generatePathStructure).toHaveBeenCalledWith(
      outputPath,
      baseDir,
    );

    expect(fs.writeFileSync).toHaveBeenCalledWith(
      outputPath,
      "generated-type-content",
    );
    expect(fs.readFileSync).not.toHaveBeenCalled();

    const expectedSuccessMessage = padMessage(
      "Path structure type",
      path.relative(process.cwd(), outputPath),
      SUCCESS_SEPARATOR,
      SUCCESS_PAD_LENGTH,
    );

    expect(logger.success).toHaveBeenCalledWith(expectedSuccessMessage, {
      indentLevel: SUCCESS_INDENT_LEVEL,
    });
  });

  it("skips writing the output file when the content is unchanged", () => {
    vi.spyOn(generatePathStructure, "generatePathStructure").mockReturnValue({
      pathStructure: "generated-type-content",
      paramsTypes: [],
    });

    vi.spyOn(fs, "existsSync").mockReturnValue(true);
    vi.spyOn(fs, "readFileSync").mockReturnValue("generated-type-content");
    vi.spyOn(fs, "writeFileSync").mockImplementation(() => {});

    generate({
      baseDir,
      outputPath,
      paramsFileName: null,
      logger,
    });

    expect(fs.readFileSync).toHaveBeenCalledWith(outputPath, "utf8");
    expect(fs.writeFileSync).not.toHaveBeenCalled();

    const expectedInfoMessage = padMessage(
      "Unchanged path type",
      path.relative(process.cwd(), outputPath),
      SUCCESS_SEPARATOR,
      SUCCESS_PAD_LENGTH,
    );

    expect(logger.info).toHaveBeenNthCalledWith(2, expectedInfoMessage, {
      indentLevel: SUCCESS_INDENT_LEVEL,
    });
    expect(logger.success).not.toHaveBeenCalled();
  });

  it("writes the output file when the existing content differs", () => {
    vi.spyOn(generatePathStructure, "generatePathStructure").mockReturnValue({
      pathStructure: "generated-type-content",
      paramsTypes: [],
    });

    vi.spyOn(fs, "existsSync").mockReturnValue(true);
    vi.spyOn(fs, "readFileSync").mockReturnValue("stale-content");
    vi.spyOn(fs, "writeFileSync").mockImplementation(() => {});

    generate({
      baseDir,
      outputPath,
      paramsFileName: null,
      logger,
    });

    expect(fs.readFileSync).toHaveBeenCalledWith(outputPath, "utf8");
    expect(fs.writeFileSync).toHaveBeenCalledWith(
      outputPath,
      "generated-type-content",
    );

    const expectedSuccessMessage = padMessage(
      "Path structure type",
      path.relative(process.cwd(), outputPath),
      SUCCESS_SEPARATOR,
      SUCCESS_PAD_LENGTH,
    );

    expect(logger.success).toHaveBeenCalledWith(expectedSuccessMessage, {
      indentLevel: SUCCESS_INDENT_LEVEL,
    });
  });

  it("writes only new or changed params files when paramsFileName is provided", () => {
    vi.spyOn(generatePathStructure, "generatePathStructure").mockReturnValue({
      pathStructure: "generated-type-content",
      paramsTypes: [
        { paramsType: "params-type-1", dirPath: "dir1" },
        { paramsType: "params-type-2", dirPath: "dir2" },
        { paramsType: "params-type-3", dirPath: "dir3" },
      ],
    });

    vi.spyOn(fs, "existsSync").mockImplementation((filePath) => {
      return (
        filePath !== outputPath &&
        filePath !== path.join("dir1", paramsFileName)
      );
    });
    vi.spyOn(fs, "readFileSync").mockImplementation((filePath) => {
      if (filePath === path.join("dir2", paramsFileName)) {
        return "params-type-2";
      }

      if (filePath === path.join("dir3", paramsFileName)) {
        return "old-params-type-3";
      }

      return "";
    });
    vi.spyOn(fs, "writeFileSync").mockImplementation(() => {});

    generate({
      baseDir,
      outputPath,
      paramsFileName,
      logger,
    });

    expect(fs.writeFileSync).toHaveBeenCalledWith(
      outputPath,
      "generated-type-content",
    );
    expect(fs.writeFileSync).toHaveBeenCalledWith(
      path.join("dir1", paramsFileName),
      "params-type-1",
    );
    expect(fs.writeFileSync).not.toHaveBeenCalledWith(
      path.join("dir2", paramsFileName),
      "params-type-2",
    );
    expect(fs.writeFileSync).toHaveBeenCalledWith(
      path.join("dir3", paramsFileName),
      "params-type-3",
    );
    expect(fs.writeFileSync).toHaveBeenCalledTimes(3);

    const expectedTypeMessage = padMessage(
      "Path structure type",
      path.relative(process.cwd(), outputPath),
      SUCCESS_SEPARATOR,
      SUCCESS_PAD_LENGTH,
    );
    expect(logger.success).toHaveBeenCalledWith(expectedTypeMessage, {
      indentLevel: SUCCESS_INDENT_LEVEL,
    });

    const expectedParamsMessage = padMessage(
      "Params types",
      paramsFileName,
      SUCCESS_SEPARATOR,
      SUCCESS_PAD_LENGTH,
    );
    expect(logger.success).toHaveBeenCalledWith(expectedParamsMessage, {
      indentLevel: SUCCESS_INDENT_LEVEL,
    });
  });

  it("logs unchanged params when all params files are unchanged", () => {
    vi.spyOn(generatePathStructure, "generatePathStructure").mockReturnValue({
      pathStructure: "generated-type-content",
      paramsTypes: [{ paramsType: "params-type-1", dirPath: "dir1" }],
    });

    vi.spyOn(fs, "existsSync").mockReturnValue(true);
    vi.spyOn(fs, "readFileSync").mockImplementation((filePath) => {
      if (filePath === outputPath) {
        return "stale-content";
      }

      return "params-type-1";
    });
    vi.spyOn(fs, "writeFileSync").mockImplementation(() => {});

    generate({
      baseDir,
      outputPath,
      paramsFileName,
      logger,
    });

    const expectedParamsInfoMessage = padMessage(
      "Unchanged params",
      paramsFileName,
      SUCCESS_SEPARATOR,
      SUCCESS_PAD_LENGTH,
    );

    expect(logger.info).toHaveBeenNthCalledWith(2, expectedParamsInfoMessage, {
      indentLevel: SUCCESS_INDENT_LEVEL,
    });
    expect(fs.writeFileSync).toHaveBeenCalledTimes(1);
    expect(fs.writeFileSync).toHaveBeenCalledWith(
      outputPath,
      "generated-type-content",
    );
  });
});
