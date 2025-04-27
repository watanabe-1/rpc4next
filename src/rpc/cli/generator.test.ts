import fs from "fs";
import path from "path";
import { describe, it, expect, vi, beforeEach } from "vitest";
import {
  SUCCESS_INDENT_LEVEL,
  SUCCESS_PAD_LENGTH,
  SUCCESS_SEPARATOR,
} from "./constants";
import * as generatePathStructure from "./core/generate-path-structure";
import { generate } from "./generator";
import { padMessage } from "./logger";

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

  it("should generate types without params file", () => {
    vi.spyOn(generatePathStructure, "generatePathStructure").mockReturnValue({
      pathStructure: "generated-type-content",
      paramsTypes: [],
    });

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
      baseDir
    );

    expect(fs.writeFileSync).toHaveBeenCalledWith(
      outputPath,
      "generated-type-content"
    );

    const expectedSuccessMessage = padMessage(
      "Path structure type",
      path.relative(process.cwd(), outputPath),
      SUCCESS_SEPARATOR,
      SUCCESS_PAD_LENGTH
    );

    expect(logger.success).toHaveBeenCalledWith(expectedSuccessMessage, {
      indentLevel: SUCCESS_INDENT_LEVEL,
    });
  });

  it("should generate types and params files when paramsFileName is provided", () => {
    vi.spyOn(generatePathStructure, "generatePathStructure").mockReturnValue({
      pathStructure: "generated-type-content",
      paramsTypes: [
        { paramsType: "params-type-1", dirPath: "dir1" },
        { paramsType: "params-type-2", dirPath: "dir2" },
      ],
    });

    vi.spyOn(fs, "writeFileSync").mockImplementation(() => {});

    generate({
      baseDir,
      outputPath,
      paramsFileName,
      logger,
    });

    expect(logger.info).toHaveBeenCalledWith("Generating types...", {
      event: "generate",
    });

    expect(generatePathStructure.generatePathStructure).toHaveBeenCalledWith(
      outputPath,
      baseDir
    );

    expect(fs.writeFileSync).toHaveBeenCalledWith(
      outputPath,
      "generated-type-content"
    );

    expect(fs.writeFileSync).toHaveBeenCalledWith(
      path.join("dir1", paramsFileName),
      "params-type-1"
    );
    expect(fs.writeFileSync).toHaveBeenCalledWith(
      path.join("dir2", paramsFileName),
      "params-type-2"
    );

    const expectedTypeMessage = padMessage(
      "Path structure type",
      path.relative(process.cwd(), outputPath),
      SUCCESS_SEPARATOR,
      SUCCESS_PAD_LENGTH
    );
    expect(logger.success).toHaveBeenCalledWith(expectedTypeMessage, {
      indentLevel: SUCCESS_INDENT_LEVEL,
    });

    const expectedParamsMessage = padMessage(
      "Params types",
      paramsFileName,
      SUCCESS_SEPARATOR,
      SUCCESS_PAD_LENGTH
    );
    expect(logger.success).toHaveBeenCalledWith(expectedParamsMessage, {
      indentLevel: SUCCESS_INDENT_LEVEL,
    });
  });
});
