import { describe, it, expect, vi } from "vitest";
import { debounce } from "./debounce";

describe("debounce", () => {
  it("should call the callback after the specified delay", () => {
    vi.useFakeTimers();
    const callback = vi.fn();
    const debounced = debounce(callback, 500);

    debounced("test");
    expect(callback).not.toHaveBeenCalled();

    vi.advanceTimersByTime(500);
    expect(callback).toHaveBeenCalledTimes(1);
    expect(callback).toHaveBeenCalledWith("test");

    vi.useRealTimers();
  });

  it("should reset the delay if called repeatedly", () => {
    vi.useFakeTimers();
    const callback = vi.fn();
    const debounced = debounce(callback, 300);

    debounced("first");
    vi.advanceTimersByTime(150);
    debounced("second");
    vi.advanceTimersByTime(150);
    debounced("third");
    vi.advanceTimersByTime(300);

    expect(callback).toHaveBeenCalledTimes(1);
    expect(callback).toHaveBeenCalledWith("third");

    vi.useRealTimers();
  });
});
