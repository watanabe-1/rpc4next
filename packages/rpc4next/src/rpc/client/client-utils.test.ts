import {
  DYNAMIC_PREFIX,
  CATCH_ALL_PREFIX,
  OPTIONAL_CATCH_ALL_PREFIX,
  HTTP_METHOD_FUNC_KEYS,
} from "rpc4next-shared";
import { describe, it, expect } from "vitest";
import {
  isDynamic,
  isCatchAllOrOptional,
  isHttpMethod,
  deepMerge,
} from "./client-utils";

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

describe("deepMerge", () => {
  it("should merge two shallow objects", () => {
    const target = { a: 1, b: 2 };
    const source = { b: 3, c: 4 };
    const result = deepMerge(target, source);
    expect(result).toEqual({ a: 1, b: 3, c: 4 });
  });

  it("should merge nested objects recursively", () => {
    const target = { a: 1, b: { x: 10, y: 20 } };
    const source = { b: { y: 30, z: 40 }, c: 3 };
    const result = deepMerge(target, source);
    expect(result).toEqual({ a: 1, b: { x: 10, y: 30, z: 40 }, c: 3 });
  });

  it("should overwrite non-object values with source values", () => {
    const target = { a: { x: 1 } };
    const source = { a: 2 };
    const result = deepMerge(target, source);
    expect(result).toEqual({ a: 2 });
  });

  it("should handle arrays by overwriting them", () => {
    const target = { arr: [1, 2, 3] };
    const source = { arr: [4, 5] };
    const result = deepMerge(target, source);
    expect(result).toEqual({ arr: [4, 5] });
  });

  it("should not mutate the target object", () => {
    const target = { a: 1, b: { x: 10 } };
    const source = { b: { y: 20 } };
    const copy = { ...target, b: { ...target.b } };
    deepMerge(target, source);
    expect(target).toEqual(copy);
  });

  it("should ignore inherited enumerable properties in source", () => {
    const proto = { inherited: "skip-me" };
    const source = Object.create(proto) as Record<string, unknown>;
    source.own = "take-me";

    const result = deepMerge({}, source);

    expect(result).toEqual({ own: "take-me" });
  });
});
