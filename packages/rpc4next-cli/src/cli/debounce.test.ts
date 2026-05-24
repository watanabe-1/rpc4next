import { describe, expect, it, vi } from "vitest";

import { debounceOnceRunningWithTrailing } from "./debounce.js";

const collectUnhandledRejections = () => {
  const rejections: unknown[] = [];
  const onUnhandledRejection = (reason: unknown) => {
    rejections.push(reason);
  };

  process.on("unhandledRejection", onUnhandledRejection);

  return {
    rejections,
    stop: () => {
      process.off("unhandledRejection", onUnhandledRejection);
    },
  };
};

describe("debounceOnceRunningWithTrailing", () => {
  it("should call the callback after the specified delay", async () => {
    vi.useFakeTimers();
    const callback = vi.fn<(value: string) => void>();
    const debounced = debounceOnceRunningWithTrailing(callback, 500);

    debounced("test");
    expect(callback).not.toHaveBeenCalled();

    vi.advanceTimersByTime(500);
    await vi.runAllTicks(); // for async handling

    expect(callback).toHaveBeenCalledTimes(1);
    expect(callback).toHaveBeenCalledWith("test");

    vi.useRealTimers();
  });

  it("should reset the delay if called repeatedly", async () => {
    vi.useFakeTimers();
    const callback = vi.fn<(value: string) => void>();
    const debounced = debounceOnceRunningWithTrailing(callback, 300);

    debounced("first");
    vi.advanceTimersByTime(150);
    debounced("second");
    vi.advanceTimersByTime(150);
    debounced("third");

    vi.advanceTimersByTime(300); // final delay passes
    await vi.runAllTicks();

    expect(callback).toHaveBeenCalledTimes(1);
    expect(callback).toHaveBeenCalledWith("third");

    vi.useRealTimers();
  });

  it("should not run again while callback is running, but should run once after it finishes", async () => {
    vi.useFakeTimers();

    const callback = vi.fn<(msg: string) => Promise<void>>(async (_msg: string) => {
      await new Promise((resolve) => setTimeout(resolve, 1000));
    });

    const debounced = debounceOnceRunningWithTrailing(callback, 300);

    debounced("A");
    vi.advanceTimersByTime(300); // triggers execution of "A"
    await vi.runAllTicks(); // enters async callback

    debounced("B"); // should be stored as pending
    debounced("C"); // overwrites B

    // still running, so nothing should be triggered yet
    vi.advanceTimersByTime(1000); // callback resolves
    await vi.runAllTicks();

    // pending "C" should now run
    await vi.advanceTimersByTimeAsync(300); // trigger pending
    await vi.runAllTicks();

    expect(callback).toHaveBeenCalledTimes(2);
    expect(callback.mock.calls[0][0]).toBe("A");
    expect(callback.mock.calls[1][0]).toBe("C");

    vi.useRealTimers();
  });

  it("should handle no-argument case correctly", async () => {
    vi.useFakeTimers();
    const callback = vi.fn<() => void>();
    const debounced = debounceOnceRunningWithTrailing(callback, 400);

    debounced(); // no arguments
    vi.advanceTimersByTime(400);
    await vi.runAllTicks();

    expect(callback).toHaveBeenCalledTimes(1);
    expect(callback).toHaveBeenCalledWith();

    vi.useRealTimers();
  });

  it("should cancel a pending timer and release its arguments", async () => {
    vi.useFakeTimers();
    const callback = vi.fn<(value: string) => void>();
    const debounced = debounceOnceRunningWithTrailing(callback, 500);

    debounced("test");
    debounced.cancel();

    vi.advanceTimersByTime(500);
    await vi.runAllTicks();

    expect(callback).not.toHaveBeenCalled();

    vi.useRealTimers();
  });

  it("should cancel pending trailing arguments while callback is running", async () => {
    vi.useFakeTimers();

    let finish!: () => void;
    const callback = vi.fn<(value: string) => Promise<void>>(async () => {
      await new Promise<void>((resolve) => {
        finish = resolve;
      });
    });
    const debounced = debounceOnceRunningWithTrailing(callback, 300);

    debounced("A");
    vi.advanceTimersByTime(300);
    await vi.runAllTicks();

    debounced("B");
    vi.advanceTimersByTime(300);
    await vi.runAllTicks();

    debounced.cancel();
    finish();
    await vi.runAllTicks();

    expect(callback).toHaveBeenCalledTimes(1);
    expect(callback).toHaveBeenCalledWith("A");

    vi.useRealTimers();
  });

  it("should not create an unhandled rejection when the callback rejects", async () => {
    vi.useFakeTimers();
    const unhandled = collectUnhandledRejections();
    const callback = vi.fn<(value: string) => Promise<void>>().mockRejectedValue(new Error("fail"));
    const debounced = debounceOnceRunningWithTrailing(callback, 100);

    try {
      debounced("A");
      await vi.advanceTimersByTimeAsync(100);
      await vi.runAllTicks();
      await Promise.resolve();

      expect(callback).toHaveBeenCalledTimes(1);
      expect(unhandled.rejections).toEqual([]);
    } finally {
      unhandled.stop();
      vi.useRealTimers();
    }
  });

  it("should run the next debounced call after a rejection", async () => {
    vi.useFakeTimers();
    const unhandled = collectUnhandledRejections();
    let callCount = 0;
    const callback = vi.fn<(value: string) => Promise<void>>(async () => {
      callCount += 1;

      if (callCount === 1) {
        throw new Error("fail");
      }
    });
    const debounced = debounceOnceRunningWithTrailing(callback, 100);

    try {
      debounced("A");
      await vi.advanceTimersByTimeAsync(100);
      await vi.runAllTicks();

      debounced("B");
      await vi.advanceTimersByTimeAsync(100);
      await vi.runAllTicks();
      await Promise.resolve();

      expect(callback).toHaveBeenCalledTimes(2);
      expect(callback.mock.calls[0][0]).toBe("A");
      expect(callback.mock.calls[1][0]).toBe("B");
      expect(unhandled.rejections).toEqual([]);
    } finally {
      unhandled.stop();
      vi.useRealTimers();
    }
  });

  it("should keep state consistent when a trailing callback rejects", async () => {
    vi.useFakeTimers();
    const unhandled = collectUnhandledRejections();
    let finishFirst!: () => void;
    const callback = vi.fn<(value: string) => Promise<void>>(async (value) => {
      if (value === "A") {
        await new Promise<void>((resolve) => {
          finishFirst = resolve;
        });
      }

      if (value === "C") {
        throw new Error("trailing fail");
      }
    });
    const debounced = debounceOnceRunningWithTrailing(callback, 100);

    try {
      debounced("A");
      await vi.advanceTimersByTimeAsync(100);
      await vi.runAllTicks();

      debounced("B");
      debounced("C");
      await vi.advanceTimersByTimeAsync(100);
      await vi.runAllTicks();

      finishFirst();
      await vi.runAllTicks();
      await Promise.resolve();

      debounced("D");
      await vi.advanceTimersByTimeAsync(100);
      await vi.runAllTicks();
      await Promise.resolve();

      expect(callback).toHaveBeenCalledTimes(3);
      expect(callback.mock.calls[0][0]).toBe("A");
      expect(callback.mock.calls[1][0]).toBe("C");
      expect(callback.mock.calls[2][0]).toBe("D");
      expect(unhandled.rejections).toEqual([]);
    } finally {
      unhandled.stop();
      vi.useRealTimers();
    }
  });
});
