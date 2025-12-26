import { describe, it, expect, afterEach } from "vitest";
import { red, cyan, green, __testing } from "./colors";

describe("colors", () => {
  afterEach(() => {
    // Reset after each test to avoid leaking state
    __testing.setIsTty(() => false);
  });

  it("adds ANSI color codes when isTty() is true", () => {
    __testing.setIsTty(() => true);

    expect(red("x")).toBe("\u001b[31mx\u001b[0m");
    expect(green("x")).toBe("\u001b[32mx\u001b[0m");
    expect(cyan("x")).toBe("\u001b[36mx\u001b[0m");
  });

  it("returns plain text when isTty() is false", () => {
    __testing.setIsTty(() => false);

    expect(red("x")).toBe("x");
    expect(green("x")).toBe("x");
    expect(cyan("x")).toBe("x");
  });
});
