import { describe, it, expect } from "vitest";
import { isDynamic, isCatchAllOrOptional, isHttpMethod } from "./utils";
import {
  DYNAMIC_PREFIX,
  CATCH_ALL_PREFIX,
  OPTIONAL_CATCH_ALL_PREFIX,
  HTTP_METHOD_FUNC_KEYS,
} from "../../lib/constants";

describe("isDynamic", () => {
  it("returns true if the string starts with DYNAMIC_PREFIX", () => {
    const key = DYNAMIC_PREFIX + "test";
    expect(isDynamic(key)).toBe(true);
  });

  it("returns false if the string does not start with DYNAMIC_PREFIX", () => {
    const key = "normalString";
    expect(isDynamic(key)).toBe(false);
  });
});

describe("isCatchAllOrOptional", () => {
  it("returns true if the string starts with CATCH_ALL_PREFIX", () => {
    const key = CATCH_ALL_PREFIX + "test";
    expect(isCatchAllOrOptional(key)).toBe(true);
  });

  it("returns true if the string starts with OPTIONAL_CATCH_ALL_PREFIX", () => {
    const key = OPTIONAL_CATCH_ALL_PREFIX + "test";
    expect(isCatchAllOrOptional(key)).toBe(true);
  });

  it("returns false if the string starts with neither prefix", () => {
    const key = "anotherTest";
    expect(isCatchAllOrOptional(key)).toBe(false);
  });
});

describe("isHttpMethod", () => {
  it("returns true if the value is included in HTTP_METHOD_FUNC_KEYS", () => {
    HTTP_METHOD_FUNC_KEYS.forEach((method) => {
      expect(isHttpMethod(method)).toBe(true);
    });
  });

  it("returns false if the value is not included in HTTP_METHOD_FUNC_KEYS", () => {
    expect(isHttpMethod("INVALID_METHOD")).toBe(false);
  });
});
