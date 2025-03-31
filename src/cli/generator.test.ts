import fs from "fs";
import { describe, it, expect, vi, beforeEach } from "vitest";
import * as generatePathStructure from "./core/generate-path-structure";
import { generate } from "./generator";

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
    vi.spyOn(generatePathStructure, "generatePages").mockReturnValue({
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

    expect(logger.info).toHaveBeenCalledWith("Generating...");
    expect(generatePathStructure.generatePages).toHaveBeenCalledWith(
      outputPath,
      baseDir
    );
    expect(fs.writeFileSync).toHaveBeenCalledWith(
      outputPath,
      "generated-type-content"
    );
    expect(logger.success).toHaveBeenCalledWith(
      `Generated types at ${outputPath}`
    );
  });

  it("should generate types and params files when paramsFileName is provided", () => {
    vi.spyOn(generatePathStructure, "generatePages").mockReturnValue({
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

    expect(logger.info).toHaveBeenCalledWith("Generating...");
    expect(generatePathStructure.generatePages).toHaveBeenCalledWith(
      outputPath,
      baseDir
    );
    expect(fs.writeFileSync).toHaveBeenCalledWith(
      outputPath,
      "generated-type-content"
    );
    expect(fs.writeFileSync).toHaveBeenCalledWith(
      "dir1/params.ts",
      "params-type-1"
    );
    expect(fs.writeFileSync).toHaveBeenCalledWith(
      "dir2/params.ts",
      "params-type-2"
    );
    expect(logger.success).toHaveBeenCalledWith(
      `Generated types at ${outputPath}`
    );
    expect(logger.success).toHaveBeenCalledWith(
      `Generated params type at ${paramsFileName}`
    );
  });
});
