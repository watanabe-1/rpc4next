import { describe, it, expect, vi, beforeEach } from "vitest";
import { handleCli } from "./cli-handler";
import * as generatorModule from "./generator";
import * as watcherModule from "./watcher";
import type { CliOptions, Logger } from "./types";

vi.mock("./generator", () => ({
  generate: vi.fn(),
}));

vi.mock("./watcher", () => ({
  setupWatcher: vi.fn(),
}));

describe("handleCli", () => {
  const baseDir = "./testDir";
  const outputPath = "./outputDir";
  let logger: Logger;

  beforeEach(() => {
    vi.clearAllMocks();
    logger = {
      error: vi.fn(),
      info: vi.fn(),
      success: vi.fn(),
    };
  });

  it("should return 1 if paramsFile is provided but is not a string", () => {
    const options: CliOptions = { paramsFile: true as unknown as string };
    const result = handleCli(baseDir, outputPath, options, logger);

    expect(result).toBe(1);
    expect(logger.error).toHaveBeenCalledWith(
      "Error: --params-file requires a filename."
    );
    expect(generatorModule.generate).not.toHaveBeenCalled();
  });

  it("should call generate with resolved paths", () => {
    const options: CliOptions = { paramsFile: "params.json" };

    const result = handleCli(baseDir, outputPath, options, logger);

    expect(result).toBe(0);
    expect(generatorModule.generate).toHaveBeenCalledWith({
      baseDir: expect.stringContaining("/testDir"),
      outputPath: expect.stringContaining("/outputDir"),
      paramsFileName: "params.json",
      logger,
    });
  });

  it("should setup watcher when watch option is true", () => {
    const options: CliOptions = { paramsFile: "params.json", watch: true };

    const result = handleCli(baseDir, outputPath, options, logger);

    expect(result).toBe(0);
    expect(generatorModule.generate).toHaveBeenCalledTimes(1);
    expect(watcherModule.setupWatcher).toHaveBeenCalledWith(
      expect.stringContaining("/testDir"),
      expect.any(Function),
      logger
    );

    const mockedSetupWatcher = vi.mocked(watcherModule.setupWatcher);
    const callback = mockedSetupWatcher.mock.calls[0][1];
    callback();

    expect(generatorModule.generate).toHaveBeenCalledTimes(2);
  });

  it("should work correctly when options are omitted", () => {
    const options: CliOptions = {};

    const result = handleCli(baseDir, outputPath, options, logger);

    expect(result).toBe(0);
    expect(generatorModule.generate).toHaveBeenCalledWith({
      baseDir: expect.stringContaining("/testDir"),
      outputPath: expect.stringContaining("/outputDir"),
      paramsFileName: null,
      logger,
    });
    expect(watcherModule.setupWatcher).not.toHaveBeenCalled();
    expect(logger.error).not.toHaveBeenCalled();
  });
});
