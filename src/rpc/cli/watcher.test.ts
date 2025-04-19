import * as path from "path";
import chokidar, { FSWatcher } from "chokidar";
import { describe, it, vi, expect, beforeEach } from "vitest";
import * as cacheModule from "./core/cache";
import * as debounceModule from "./debounce";
import { setupWatcher } from "./watcher";

vi.mock("./core/cache", () => ({
  clearCntCache: vi.fn(),
  clearVisitedDirsCacheAbove: vi.fn(),
  clearScanAppDirCacheAbove: vi.fn(),
}));

vi.spyOn(debounceModule, "debounceOnceRunningWithTrailing").mockImplementation(
  (fn) => fn
);

const logger = {
  info: vi.fn(),
  success: vi.fn(),
  error: vi.fn(),
};

const onGenerate = vi.fn();

const fakeOn = vi.fn();
const fakeWatcher = {
  on: fakeOn,
};
vi.spyOn(chokidar, "watch").mockReturnValue(
  fakeWatcher as unknown as FSWatcher
);

describe("setupWatcher", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    fakeOn.mockReset();
  });

  it("should log relative path with watch event", () => {
    const baseDir = "/base/dir";
    setupWatcher(baseDir, onGenerate, logger);

    const expectedRelative = path.relative(process.cwd(), baseDir);

    expect(logger.info).toHaveBeenCalledWith(expectedRelative, {
      event: "watch",
    });
  });

  it("should setup watcher and react to target file events", () => {
    const baseDir = "/base/dir";
    const targetPath = "/base/dir/foo/page.tsx";

    setupWatcher(baseDir, onGenerate, logger);

    const readyHandler = fakeOn.mock.calls.find(
      (call) => call[0] === "ready"
    )?.[1];

    let allHandler: ((event: string, path: string) => void) | undefined;
    fakeOn.mockImplementation((event, cb) => {
      if (event === "all") {
        allHandler = cb;
      }

      return fakeWatcher;
    });

    readyHandler?.(); // debouncedGenerate runs once
    allHandler?.("change", targetPath);

    const expectedRelative = path.relative(process.cwd(), targetPath);

    expect(logger.info).toHaveBeenCalledWith(expectedRelative, {
      event: "change",
    });
    expect(cacheModule.clearVisitedDirsCacheAbove).toHaveBeenCalledWith(
      targetPath
    );
    expect(cacheModule.clearScanAppDirCacheAbove).toHaveBeenCalledWith(
      targetPath
    );
    expect(onGenerate).toHaveBeenCalledTimes(2); // ready + change
  });

  it("should ignore non-target files", () => {
    const baseDir = "/base/dir";
    const nonTargetPath = "/base/dir/foo/other.txt";

    setupWatcher(baseDir, onGenerate, logger);

    const readyHandler = fakeOn.mock.calls.find(
      (call) => call[0] === "ready"
    )?.[1];

    fakeOn.mockImplementation((event, cb) => {
      if (event === "all") {
        cb("change", nonTargetPath);
      }

      return fakeWatcher;
    });

    readyHandler?.();

    const expectedRelative = path.relative(process.cwd(), nonTargetPath);

    expect(logger.info).not.toHaveBeenCalledWith(
      expectedRelative,
      expect.anything()
    );
    expect(cacheModule.clearVisitedDirsCacheAbove).not.toHaveBeenCalled();
    expect(cacheModule.clearScanAppDirCacheAbove).not.toHaveBeenCalled();
    expect(onGenerate).toHaveBeenCalledTimes(1); // only from ready
  });

  it("should process multiple changed paths before debounce triggers", () => {
    const baseDir = "/base/dir";
    const path1 = "/base/dir/foo/page.tsx";
    const path2 = "/base/dir/bar/route.ts";

    setupWatcher(baseDir, onGenerate, logger);

    const readyHandler = fakeOn.mock.calls.find(
      (call) => call[0] === "ready"
    )?.[1];

    let allHandler: ((event: string, path: string) => void) | undefined;
    fakeOn.mockImplementation((event, cb) => {
      if (event === "all") {
        allHandler = cb;
      }

      return fakeWatcher;
    });

    readyHandler?.();

    allHandler?.("change", path1);
    allHandler?.("change", path2);

    const expectedRelative1 = path.relative(process.cwd(), path1);

    const expectedRelative2 = path.relative(process.cwd(), path2);

    expect(logger.info).toHaveBeenCalledWith(expectedRelative1, {
      event: "change",
    });
    expect(logger.info).toHaveBeenCalledWith(expectedRelative2, {
      event: "change",
    });

    expect(cacheModule.clearVisitedDirsCacheAbove).toHaveBeenCalledWith(path1);
    expect(cacheModule.clearScanAppDirCacheAbove).toHaveBeenCalledWith(path1);
    expect(cacheModule.clearVisitedDirsCacheAbove).toHaveBeenCalledWith(path2);
    expect(cacheModule.clearScanAppDirCacheAbove).toHaveBeenCalledWith(path2);

    expect(onGenerate).toHaveBeenCalledTimes(3); // ready + 2 changes
  });

  it("should log error on watcher error", () => {
    setupWatcher("/base/dir", onGenerate, logger);

    const errorHandler = fakeOn.mock.calls.find(
      (call) => call[0] === "error"
    )?.[1];

    expect(errorHandler).toBeDefined();

    errorHandler?.(new Error("Something went wrong"));

    expect(logger.error).toHaveBeenCalledWith(
      "Watcher error: Something went wrong"
    );

    errorHandler?.("some string error");

    expect(logger.error).toHaveBeenCalledWith(
      "Unknown watcher error: some string error"
    );
  });

  it("should close watcher on SIGINT/SIGTERM", async () => {
    const handlers: Record<string, () => void | Promise<void>> = {};
    vi.spyOn(process, "on").mockImplementation((event, handler) => {
      if (typeof event === "string") {
        handlers[event] = handler;
      }

      return process;
    });

    const logger = {
      info: vi.fn(),
      success: vi.fn(),
      error: vi.fn(),
    };

    // On success
    const mockClose = vi.fn().mockResolvedValue(undefined);
    const watcherSuccess = {
      on: vi.fn(),
      close: mockClose,
    };

    vi.spyOn(chokidar, "watch").mockReturnValueOnce(
      watcherSuccess as unknown as FSWatcher
    );

    setupWatcher("/base/dir", onGenerate, logger);
    await handlers["SIGINT"]?.();

    expect(mockClose).toHaveBeenCalled();
    expect(logger.info).toHaveBeenCalledWith("Watcher closed.", {
      event: "watch",
    });

    process.removeAllListeners("SIGTERM");

    // On failure
    const mockCloseError = vi.fn().mockRejectedValue(new Error("close fail"));
    const watcherError = {
      on: vi.fn(),
      close: mockCloseError,
    };

    vi.spyOn(chokidar, "watch").mockReturnValueOnce(
      watcherError as unknown as FSWatcher
    );

    setupWatcher("/base/dir", onGenerate, logger);

    const flushPromises = () => new Promise(setImmediate);
    await handlers["SIGTERM"]?.();
    // Ensure the async catch() is executed
    await flushPromises();

    expect(mockCloseError).toHaveBeenCalled();
    expect(logger.error).toHaveBeenCalledWith(
      "Failed to close watcher: close fail"
    );
  });

  it("should correctly ignore non-target files and include target files", () => {
    type IgnoredFn = (path: string, stats?: { isFile(): boolean }) => boolean;

    const baseDir = "/base/dir";
    let ignoredFn: IgnoredFn | undefined;

    vi.spyOn(chokidar, "watch").mockImplementationOnce((_, options) => {
      ignoredFn = options?.ignored as IgnoredFn;

      return fakeWatcher as unknown as FSWatcher;
    });

    setupWatcher(baseDir, onGenerate, logger);

    expect(ignoredFn).toBeDefined();

    // If we exclude everything except files using ignored, the watch mode will terminate, so we added "only files" to the exclusion condition.
    expect(
      ignoredFn?.("/base/dir/should/ignore", { isFile: () => false })
    ).toBe(false);

    expect(ignoredFn?.("/base/dir/non-target.ts", { isFile: () => true })).toBe(
      true
    );

    expect(ignoredFn?.("/base/dir/route.ts", { isFile: () => true })).toBe(
      false
    );

    expect(ignoredFn?.("/base/dir/page.tsx", { isFile: () => true })).toBe(
      false
    );
  });
});
