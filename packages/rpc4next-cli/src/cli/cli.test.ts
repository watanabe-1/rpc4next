import { describe, it, vi, expect, beforeEach, afterEach } from "vitest";
import { runCli } from "./cli";
import * as cliHandler from "./cli-handler";
import * as loggerModule from "./logger";

describe("runCli", () => {
  const mockLogger = {
    error: vi.fn(),
    info: vi.fn(),
    success: vi.fn(),
  };

  beforeEach(() => {
    vi.spyOn(loggerModule, "createLogger").mockReturnValue(mockLogger);
    vi.spyOn(process, "exit").mockImplementation((() => {}) as () => never);
  });

  afterEach(() => {
    vi.restoreAllMocks();
  });

  it("should call handleCli and process.exit when not watching", () => {
    const handleCliSpy = vi.spyOn(cliHandler, "handleCli").mockReturnValue(0);

    const argv = ["node", "script", "src", "types.ts"];
    runCli(argv);

    expect(handleCliSpy).toHaveBeenCalledWith(
      "src",
      "types.ts",
      {},
      mockLogger
    );
  });

  it("should not call process.exit when watch is true", () => {
    const handleCliSpy = vi.spyOn(cliHandler, "handleCli").mockReturnValue(0);
    const argv = ["node", "script", "src", "types.ts", "--watch"];

    runCli(argv);

    expect(handleCliSpy).toHaveBeenCalledWith(
      "src",
      "types.ts",
      { watch: true, paramsFile: undefined },
      mockLogger
    );
    expect(process.exit).not.toHaveBeenCalled();
  });

  it("should pass params-file option correctly", () => {
    const handleCliSpy = vi.spyOn(cliHandler, "handleCli").mockReturnValue(0);
    const argv = [
      "node",
      "script",
      "src",
      "types.ts",
      "--params-file",
      "myparams",
    ];

    runCli(argv);

    expect(handleCliSpy).toHaveBeenCalledWith(
      "src",
      "types.ts",
      { paramsFile: "myparams" },
      mockLogger
    );
  });

  it("should log error with Error instance and exit", async () => {
    vi.spyOn(cliHandler, "handleCli").mockImplementation(() => {
      throw new Error("Something went wrong");
    });

    const argv = ["node", "script", "src", "types.ts"];
    runCli(argv);
    await new Promise((resolve) => setTimeout(resolve, 0));

    expect(mockLogger.error).toHaveBeenCalledWith(
      "Unexpected error occurred:Something went wrong"
    );
    expect(process.exit).toHaveBeenCalledWith(1);
  });

  it("should log error with non-Error and exit", async () => {
    vi.spyOn(cliHandler, "handleCli").mockImplementation(() => {
      throw "plain string error";
    });

    const argv = ["node", "script", "src", "types.ts"];
    runCli(argv);
    await new Promise((resolve) => setTimeout(resolve, 0));

    expect(mockLogger.error).toHaveBeenCalledWith(
      "Unexpected error occurred:plain string error"
    );
    expect(process.exit).toHaveBeenCalledWith(1);
  });
});
