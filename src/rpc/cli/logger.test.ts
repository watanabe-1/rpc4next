import {
  describe,
  it,
  expect,
  vi,
  beforeAll,
  afterAll,
  beforeEach,
} from "vitest";
import { INDENT } from "./core/constants";
import { createLogger, padMessage } from "./logger";

const stripAnsi = (s: string) => {
  const ESC = String.fromCharCode(27); // 0x1b
  const re = new RegExp(`${ESC}\\[[0-9;]*m`, "g");

  return s.replace(re, "");
};

describe("createLogger", () => {
  const originalLog = console.log;
  const originalError = console.error;

  const mockLog = vi.fn();
  const mockError = vi.fn();

  beforeAll(() => {
    console.log = mockLog;
    console.error = mockError;
  });

  afterAll(() => {
    console.log = originalLog;
    console.error = originalError;
  });

  beforeEach(() => {
    mockLog.mockClear();
    mockError.mockClear();
  });

  it("should log info without options", () => {
    const logger = createLogger();
    logger.info("info message");

    expect(mockLog).toHaveBeenCalledWith("info message");
  });

  it("should log info with indent and event", () => {
    const logger = createLogger();
    const indent = INDENT.repeat(2);

    logger.info("info message", { indentLevel: 2, event: "scan" });

    const actual = mockLog.mock.calls[0]?.[0];
    expect(stripAnsi(actual)).toBe(`${indent}[scan] info message`);
  });

  it("should log success without options", () => {
    const logger = createLogger();

    logger.success("success message");

    const actual = mockLog.mock.calls[0]?.[0];
    expect(stripAnsi(actual)).toBe(`✓ success message`);
  });

  it("should log success with indent", () => {
    const logger = createLogger();
    const indent = INDENT.repeat(1);

    logger.success("success message", { indentLevel: 1 });

    const actual = mockLog.mock.calls[0]?.[0];
    expect(stripAnsi(actual)).toBe(`${indent}✓ success message`);
  });

  it("should log error without options", () => {
    const logger = createLogger();

    logger.error("error message");

    const actual = mockError.mock.calls[0]?.[0];
    expect(stripAnsi(actual)).toBe(`✗ error message`);
  });

  it("should log error with indent", () => {
    const logger = createLogger();
    const indent = INDENT.repeat(1);

    logger.error("error message", { indentLevel: 1 });

    const actual = mockError.mock.calls[0]?.[0];
    expect(stripAnsi(actual)).toBe(`${indent}✗ error message`);
  });
});

describe("padMessage", () => {
  it("should pad label and format the message with default separator", () => {
    const result = padMessage("Label", "Value");
    expect(result).toBe("Label                    → Value");
  });

  it("should use custom separator", () => {
    const result = padMessage("Label", "Value", "=");
    expect(result).toBe("Label                    = Value");
  });

  it("should pad to given target length", () => {
    const result = padMessage("Short", "Data", "→", 10);
    expect(result).toBe("Short      → Data");
  });
});
