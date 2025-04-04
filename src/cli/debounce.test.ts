import { describe, it, expect, vi } from "vitest";
import { debounceOnceRunningWithTrailing } from "./debounce";

describe("debounceOnceRunningWithTrailing", () => {
  it("should call the callback after the specified delay", async () => {
    vi.useFakeTimers();
    const callback = vi.fn();
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
    const callback = vi.fn();
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

    const callback = vi.fn(async (_msg: string) => {
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
    const callback = vi.fn();
    const debounced = debounceOnceRunningWithTrailing(callback, 400);

    debounced(); // no arguments
    vi.advanceTimersByTime(400);
    await vi.runAllTicks();

    expect(callback).toHaveBeenCalledTimes(1);
    expect(callback).toHaveBeenCalledWith();

    vi.useRealTimers();
  });
});
