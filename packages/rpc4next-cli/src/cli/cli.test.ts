import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { runCli } from "./cli";
import * as cliHandler from "./cli-handler";
import { EXIT_FAILURE } from "./constants";
import * as loggerModule from "./logger";

const flushAsync = async () => {
  await Promise.resolve();
  await new Promise((resolve) => setTimeout(resolve, 0));
};

class ExitSignal extends Error {
  constructor(readonly code: number | undefined) {
    super(`process.exit(${String(code)})`);
  }
}

describe("runCli", () => {
  const mockLogger = {
    error: vi.fn(),
    info: vi.fn(),
    success: vi.fn(),
  };

  beforeEach(() => {
    vi.clearAllMocks();
    vi.spyOn(loggerModule, "createLogger").mockReturnValue(mockLogger);
    vi.spyOn(process, "exit").mockImplementation((() => undefined) as never);
  });

  afterEach(() => {
    vi.restoreAllMocks();
  });

  it("calls handleCli with required positionals", async () => {
    const handleCliSpy = vi.spyOn(cliHandler, "handleCli").mockResolvedValue(0);

    runCli(["node", "cli", "src", "types.ts"]);
    await flushAsync();

    expect(handleCliSpy).toHaveBeenCalledWith(
      "src",
      "types.ts",
      { watch: false },
      mockLogger,
    );
  });

  it("exits with failure and prints help when required args are missing", () => {
    const handleCliSpy = vi.spyOn(cliHandler, "handleCli").mockResolvedValue(0);
    const exitSpy = vi.spyOn(process, "exit").mockImplementation(
      ((code?: number) => {
        throw new ExitSignal(code);
      }) as never,
    );

    expect(() => runCli(["node", "cli", "src"])).toThrow(ExitSignal);

    expect(handleCliSpy).not.toHaveBeenCalled();
    expect(mockLogger.error).toHaveBeenCalledWith(
      "Missing required arguments: <baseDir> <outputPath>",
    );
    expect(mockLogger.info).toHaveBeenCalled();
    expect(exitSpy).toHaveBeenCalledWith(EXIT_FAILURE);
  });

  it("exits with returned code when --watch is not set", async () => {
    vi.spyOn(cliHandler, "handleCli").mockResolvedValue(0);

    runCli(["node", "cli", "src", "types.ts"]);
    await flushAsync();

    expect(process.exit).toHaveBeenCalledWith(0);
  });

  it("does not call process.exit when --watch is set", async () => {
    const handleCliSpy = vi.spyOn(cliHandler, "handleCli").mockResolvedValue(0);

    runCli(["node", "cli", "src", "types.ts", "--watch"]);
    await flushAsync();

    expect(handleCliSpy).toHaveBeenCalledWith(
      "src",
      "types.ts",
      { watch: true },
      mockLogger,
    );
    expect(process.exit).not.toHaveBeenCalled();
  });

  it("supports short watch flag (-w) for README-like usage", async () => {
    const handleCliSpy = vi.spyOn(cliHandler, "handleCli").mockResolvedValue(0);

    runCli(["node", "cli", "app", "src/types/rpc.ts", "-w"]);
    await flushAsync();

    expect(handleCliSpy).toHaveBeenCalledWith(
      "app",
      "src/types/rpc.ts",
      { watch: true },
      mockLogger,
    );
    expect(process.exit).not.toHaveBeenCalled();
  });

  it.each([
    { argv: ["node", "cli", "src", "types.ts", "-p"], expected: true },
    {
      argv: ["node", "cli", "src", "types.ts", "-p", "foo.ts"],
      expected: "foo.ts",
    },
    {
      argv: ["node", "cli", "src", "types.ts", "--params-file"],
      expected: true,
    },
    {
      argv: ["node", "cli", "src", "types.ts", "--params-file", "foo.ts"],
      expected: "foo.ts",
    },
    {
      argv: ["node", "cli", "src", "types.ts", "--params-file=foo.ts"],
      expected: "foo.ts",
    },
    {
      argv: ["node", "cli", "src", "types.ts", "--params-file="],
      expected: true,
    },
  ])("parses params-file option: $argv", async ({ argv, expected }) => {
    const handleCliSpy = vi.spyOn(cliHandler, "handleCli").mockResolvedValue(0);

    runCli(argv);
    await flushAsync();

    expect(handleCliSpy).toHaveBeenCalledWith(
      "src",
      "types.ts",
      { watch: false, paramsFile: expected },
      mockLogger,
    );
  });

  it("normalizes argv shape from process.argv and user-args-only", async () => {
    const handleCliSpy = vi.spyOn(cliHandler, "handleCli").mockResolvedValue(0);

    runCli(["node", "cli", "src", "types.ts"]);
    runCli(["src", "types.ts"]);
    await flushAsync();

    expect(handleCliSpy).toHaveBeenNthCalledWith(
      1,
      "src",
      "types.ts",
      { watch: false },
      mockLogger,
    );
    expect(handleCliSpy).toHaveBeenNthCalledWith(
      2,
      "src",
      "types.ts",
      { watch: false },
      mockLogger,
    );
  });

  it("normalizes argv when runtime token is a full executable path", async () => {
    const handleCliSpy = vi.spyOn(cliHandler, "handleCli").mockResolvedValue(0);

    runCli([
      "/usr/local/bin/node",
      "/work/rpc4next/packages/rpc4next-cli/dist/index.js",
      "src",
      "types.ts",
    ]);
    await flushAsync();

    expect(handleCliSpy).toHaveBeenCalledWith(
      "src",
      "types.ts",
      { watch: false },
      mockLogger,
    );
  });

  it("accepts user-args-only help flag that starts with '-'", () => {
    const handleCliSpy = vi.spyOn(cliHandler, "handleCli").mockResolvedValue(0);
    const exitSpy = vi.spyOn(process, "exit").mockImplementation(
      ((code?: number) => {
        throw new ExitSignal(code);
      }) as never,
    );

    expect(() => runCli(["--help"])).toThrow(ExitSignal);

    expect(handleCliSpy).not.toHaveBeenCalled();
    expect(mockLogger.info).toHaveBeenCalled();
    expect(exitSpy).toHaveBeenCalledWith(0);
  });

  it.each([
    ["-h"],
    ["--help"],
  ])("exits 0 and skips handleCli on help: %s", (helpFlag) => {
    const handleCliSpy = vi.spyOn(cliHandler, "handleCli").mockResolvedValue(0);
    const exitSpy = vi.spyOn(process, "exit").mockImplementation(
      ((code?: number) => {
        throw new ExitSignal(code);
      }) as never,
    );

    expect(() => runCli(["node", "cli", helpFlag])).toThrow(ExitSignal);

    expect(handleCliSpy).not.toHaveBeenCalled();
    expect(mockLogger.info).toHaveBeenCalled();
    expect(exitSpy).toHaveBeenCalledWith(0);
  });

  it("exits with failure on unknown option", () => {
    const handleCliSpy = vi.spyOn(cliHandler, "handleCli").mockResolvedValue(0);

    runCli(["node", "cli", "src", "types.ts", "--unknown"]);

    expect(handleCliSpy).not.toHaveBeenCalled();
    expect(mockLogger.error).toHaveBeenCalledTimes(1);
    expect(mockLogger.info).toHaveBeenCalledTimes(1);
    expect(process.exit).toHaveBeenCalledWith(EXIT_FAILURE);
  });

  it("exits with failure when argv is empty", () => {
    const handleCliSpy = vi.spyOn(cliHandler, "handleCli").mockResolvedValue(0);
    const exitSpy = vi.spyOn(process, "exit").mockImplementation(
      ((code?: number) => {
        throw new ExitSignal(code);
      }) as never,
    );

    expect(() => runCli([])).toThrow(ExitSignal);

    expect(handleCliSpy).not.toHaveBeenCalled();
    expect(mockLogger.error).toHaveBeenCalledWith(
      "Missing required arguments: <baseDir> <outputPath>",
    );
    expect(exitSpy).toHaveBeenCalledWith(EXIT_FAILURE);
  });

  it("treats `-p --watch` as paramsFile=true and watch=true", async () => {
    const handleCliSpy = vi.spyOn(cliHandler, "handleCli").mockResolvedValue(0);

    runCli(["node", "cli", "src", "types.ts", "-p", "--watch"]);
    await flushAsync();

    expect(handleCliSpy).toHaveBeenCalledWith(
      "src",
      "types.ts",
      { watch: true, paramsFile: true },
      mockLogger,
    );
    expect(process.exit).not.toHaveBeenCalled();
  });

  it("logs and exits when handleCli throws Error", async () => {
    vi.spyOn(cliHandler, "handleCli").mockRejectedValue(
      new Error("Something went wrong"),
    );

    runCli(["node", "cli", "src", "types.ts"]);
    await flushAsync();

    expect(mockLogger.error).toHaveBeenCalledWith(
      "Unexpected error occurred:Something went wrong",
    );
    expect(process.exit).toHaveBeenCalledWith(EXIT_FAILURE);
  });

  it("logs and exits when handleCli throws non-Error", async () => {
    vi.spyOn(cliHandler, "handleCli").mockRejectedValue("plain string error");

    runCli(["node", "cli", "src", "types.ts"]);
    await flushAsync();

    expect(mockLogger.error).toHaveBeenCalledWith(
      "Unexpected error occurred:plain string error",
    );
    expect(process.exit).toHaveBeenCalledWith(EXIT_FAILURE);
  });

  it("logs invalid arguments when non-Error is thrown in outer try block", () => {
    const handleCliSpy = vi.spyOn(cliHandler, "handleCli").mockResolvedValue(0);
    const exitSpy = vi.spyOn(process, "exit").mockImplementation(
      ((code?: number) => {
        if (code === 0) throw "EXIT_NON_ERROR";
        throw new ExitSignal(code);
      }) as never,
    );

    expect(() => runCli(["--help"])).toThrow(ExitSignal);

    expect(handleCliSpy).not.toHaveBeenCalled();
    expect(mockLogger.error).toHaveBeenCalledWith(
      "Invalid arguments: EXIT_NON_ERROR",
    );
    expect(exitSpy).toHaveBeenLastCalledWith(EXIT_FAILURE);
  });
});
