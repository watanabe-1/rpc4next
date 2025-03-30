import {
  describe,
  it,
  expect,
  vi,
  beforeAll,
  afterAll,
  beforeEach,
} from "vitest";
import { createLogger } from "./logger";

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

  it("should call console.log on info", () => {
    const logger = createLogger();
    logger.info("info message");
    expect(mockLog).toHaveBeenCalledWith("info message");
  });

  it("should call console.log on success", () => {
    const logger = createLogger();
    logger.success("success message");
    expect(mockLog).toHaveBeenCalledWith("success message");
  });

  it("should call console.error on error", () => {
    const logger = createLogger();
    logger.error("error message");
    expect(mockError).toHaveBeenCalledWith("error message");
  });
});
