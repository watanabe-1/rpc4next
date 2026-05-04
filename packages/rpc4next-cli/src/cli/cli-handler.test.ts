import { beforeEach, describe, expect, it, vi } from "vitest";

import { handleCli } from "./cli-handler.js";
import * as generatorModule from "./generator.js";
import type { CliOptions, Logger } from "./types.js";
import * as watcherModule from "./watcher.js";

vi.mock("./generator.js", () => ({
  generate: vi.fn<(...args: unknown[]) => unknown>(),
}));

vi.mock("./watcher.js", () => ({
  setupWatcher: vi.fn<(...args: unknown[]) => unknown>(),
}));

describe("handleCli", () => {
  const baseDir = "./testDir";
  const outputPath = "./outputDir";
  let logger: Logger;

  beforeEach(() => {
    vi.clearAllMocks();
    logger = {
      error: vi.fn<(...args: unknown[]) => void>(),
      info: vi.fn<(...args: unknown[]) => void>(),
      success: vi.fn<(...args: unknown[]) => void>(),
    };
  });

  it("should return 1 if paramsFile is provided but is not a string", () => {
    const options: CliOptions = { paramsFile: true as unknown as string };
    const result = handleCli(baseDir, outputPath, options, logger);

    expect(result).toBe(1);
    expect(logger.error).toHaveBeenCalledWith("Error: --params-file requires a filename.");
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
    expect(generatorModule.generate).toHaveBeenCalledTimes(0);
    expect(watcherModule.setupWatcher).toHaveBeenCalledWith(
      expect.stringContaining("/testDir"),
      expect.any(Function),
      logger,
    );

    const mockedSetupWatcher = vi.mocked(watcherModule.setupWatcher);
    const callback = mockedSetupWatcher.mock.calls[0][1];
    callback();

    expect(generatorModule.generate).toHaveBeenCalledTimes(1);
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

  it("should return 1 and log error if generate throws an error", () => {
    const options: CliOptions = { paramsFile: "params.json" };
    const error = new Error("something went wrong");
    vi.mocked(generatorModule.generate).mockImplementation(() => {
      throw error;
    });

    const result = handleCli(baseDir, outputPath, options, logger);

    expect(result).toBe(1);
    expect(logger.error).toHaveBeenCalledWith("Failed to generate: something went wrong");
  });

  it("should return 1 and log unknown error if generate throws a non-Error", () => {
    const options: CliOptions = { paramsFile: "params.json" };
    vi.mocked(generatorModule.generate).mockImplementation(() => {
      throw "non-error string";
    });

    const result = handleCli(baseDir, outputPath, options, logger);

    expect(result).toBe(1);
    expect(logger.error).toHaveBeenCalledWith(
      "Unknown error occurred during generate: non-error string",
    );
  });

  it("should not throw even if generate fails during watch mode", () => {
    const options: CliOptions = { paramsFile: "params.json", watch: true };
    const error = new Error("watch failure");
    vi.mocked(generatorModule.generate).mockImplementation(() => {
      throw error;
    });

    const result = handleCli(baseDir, outputPath, options, logger);

    expect(result).toBe(0); // watch mode itself starts successfully

    const mockedSetupWatcher = vi.mocked(watcherModule.setupWatcher);
    const callback = mockedSetupWatcher.mock.calls[0][1];
    callback();

    expect(logger.error).toHaveBeenCalledWith("Failed to generate: watch failure");
  });
});
