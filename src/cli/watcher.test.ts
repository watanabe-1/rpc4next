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

  it("should setup watcher and react to target file events", () => {
    setupWatcher("/base/dir", onGenerate, logger);

    expect(logger.info).toHaveBeenCalledWith("Watching /base/dir...");
    expect(chokidar.watch).toHaveBeenCalledWith(
      "/base/dir",
      expect.any(Object)
    );

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

    readyHandler?.(); // debouncedGenerate() runs once here

    allHandler?.("change", "/base/dir/foo/page.tsx");

    expect(logger.info).toHaveBeenCalledWith("[change] /base/dir/foo/page.tsx");
    expect(cacheModule.clearVisitedDirsCacheAbove).toHaveBeenCalledWith(
      "/base/dir/foo/page.tsx"
    );
    expect(cacheModule.clearScanAppDirCacheAbove).toHaveBeenCalledWith(
      "/base/dir/foo/page.tsx"
    );
    expect(onGenerate).toHaveBeenCalledTimes(2);
  });

  it("should ignore non-target files", () => {
    setupWatcher("/base/dir", onGenerate, logger);

    const readyHandler = fakeOn.mock.calls.find(
      (call) => call[0] === "ready"
    )?.[1];

    fakeOn.mockImplementation((event, cb) => {
      if (event === "all") {
        cb("change", "/base/dir/foo/other.txt");
      }

      return fakeWatcher;
    });

    readyHandler?.();

    // Only the initial call from ready
    expect(logger.info).not.toHaveBeenCalledWith(
      "[change] /base/dir/foo/other.txt"
    );
    expect(cacheModule.clearVisitedDirsCacheAbove).not.toHaveBeenCalled();
    expect(cacheModule.clearScanAppDirCacheAbove).not.toHaveBeenCalled();
    expect(onGenerate).toHaveBeenCalledTimes(1); // only from ready
  });

  it("should process multiple changed paths before debounce triggers", () => {
    setupWatcher("/base/dir", onGenerate, logger);

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

    allHandler?.("change", "/base/dir/foo/page.tsx");
    allHandler?.("change", "/base/dir/bar/route.ts");

    expect(logger.info).toHaveBeenCalledWith("[change] /base/dir/foo/page.tsx");
    expect(logger.info).toHaveBeenCalledWith("[change] /base/dir/bar/route.ts");

    expect(cacheModule.clearVisitedDirsCacheAbove).toHaveBeenCalledWith(
      "/base/dir/foo/page.tsx"
    );
    expect(cacheModule.clearScanAppDirCacheAbove).toHaveBeenCalledWith(
      "/base/dir/foo/page.tsx"
    );
    expect(cacheModule.clearVisitedDirsCacheAbove).toHaveBeenCalledWith(
      "/base/dir/bar/route.ts"
    );
    expect(cacheModule.clearScanAppDirCacheAbove).toHaveBeenCalledWith(
      "/base/dir/bar/route.ts"
    );

    expect(onGenerate).toHaveBeenCalledTimes(3);
  });
});
