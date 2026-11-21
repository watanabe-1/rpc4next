import {
  CATCH_ALL_PREFIX,
  DYNAMIC_PREFIX,
  HTTP_METHOD_FUNC_KEYS,
  OPTIONAL_CATCH_ALL_PREFIX,
} from "rpc4next-shared";
import { describe, expect, it } from "vitest";

import {
  deepMerge,
  getParamName,
  isCatchAllOrOptional,
  isDynamic,
  isHttpMethod,
  isOptionalCatchAll,
} from "./client-utils";

describe("getParamName", () => {
  it.each([
    ["_id", "id"],
    ["_%5Fid", "_id"],
    ["_%5F%5Fid", "__id"],
    ["_%5F%5F%5F%5Fid", "____id"],
    ["___%5F%5Fid", "__id"],
    ["_____%5F%5Fid", "__id"],
    ["_%255Fid", "%5Fid"],
    ["__id", "_id"],
    ["___slug", "slug"],
    ["____slug", "_slug"],
    ["_____slug", "slug"],
    ["______slug", "_slug"],
    ["_______slug", "__slug"],
    ["%5Fescaped", "%5Fescaped"],
    ["static", "static"],
  ])("restores %s as %s", (key, name) => {
    expect(getParamName(key)).toBe(name);
  });
});

describe("isDynamic", () => {
  it("returns true if the string starts with DYNAMIC_PREFIX", () => {
    const key = `${DYNAMIC_PREFIX}test`;
    expect(isDynamic(key)).toBe(true);
  });

  it("returns false if the string does not start with DYNAMIC_PREFIX", () => {
    const key = "normalString";
    expect(isDynamic(key)).toBe(false);
  });
});

describe("isCatchAllOrOptional", () => {
  it("returns true if the string starts with CATCH_ALL_PREFIX", () => {
    const key = `${CATCH_ALL_PREFIX}test`;
    expect(isCatchAllOrOptional(key)).toBe(true);
  });

  it("returns true if the string starts with OPTIONAL_CATCH_ALL_PREFIX", () => {
    const key = `${OPTIONAL_CATCH_ALL_PREFIX}test`;
    expect(isCatchAllOrOptional(key)).toBe(true);
  });

  it("returns false if the string starts with neither prefix", () => {
    const key = "anotherTest";
    expect(isCatchAllOrOptional(key)).toBe(false);
  });
});

describe("isOptionalCatchAll", () => {
  it("returns true if the string starts with OPTIONAL_CATCH_ALL_PREFIX", () => {
    const key = `${OPTIONAL_CATCH_ALL_PREFIX}test`;
    expect(isOptionalCatchAll(key)).toBe(true);
  });

  it("returns false for non-optional catch-all keys", () => {
    const key = `${CATCH_ALL_PREFIX}test`;
    expect(isOptionalCatchAll(key)).toBe(false);
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

  it("should overwrite AbortSignals while recursively merging plain init objects", () => {
    const defaultSignal = new AbortController().signal;
    const signal = new AbortController().signal;
    const target = { init: { signal: defaultSignal, cache: "no-cache" } };
    const source = { init: { signal, mode: "cors" } };

    const result = deepMerge(target, source);

    expect(result.init.signal).toBe(signal);
    expect(result.init.cache).toBe("no-cache");
    expect(result.init.mode).toBe("cors");
    expect(target.init.signal).toBe(defaultSignal);
  });

  it("should preserve a default AbortSignal when no override is supplied", () => {
    const signal = new AbortController().signal;

    const result = deepMerge({ init: { signal } }, { init: { cache: "no-cache" } });

    expect(result.init.signal).toBe(signal);
    expect(result.init.cache).toBe("no-cache");
  });

  it("should replace a null default signal with an AbortSignal", () => {
    const signal = new AbortController().signal;

    const result = deepMerge(
      { init: { signal: null as AbortSignal | null } },
      { init: { signal } },
    );

    expect(result.init.signal).toBe(signal);
  });

  it("should overwrite class instances with the source instance", () => {
    class Options {
      constructor(public value: string) {}
    }
    const source = new Options("source");

    const result = deepMerge({ options: new Options("target") }, { options: source });

    expect(result.options).toBe(source);
  });

  it("should recursively merge objects with null prototypes", () => {
    const target = Object.assign(Object.create(null), { nested: { a: 1, b: 2 } });
    const source = Object.assign(Object.create(null), { nested: { b: 3, c: 4 } });

    const result = deepMerge({ options: target }, { options: source });

    expect(result.options).toEqual({ nested: { a: 1, b: 3, c: 4 } });
    expect(Object.getPrototypeOf(result.options)).toBeNull();
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

  it("should keep prototype-like keys as data properties", () => {
    const source = Object.create(null) as Record<string, unknown>;
    source.__proto__ = "polluted";
    source["constructor"] = "value";

    const result = deepMerge({}, source);

    expect(Object.getPrototypeOf(result)).toBeNull();
    expect(result.__proto__).toBe("polluted");
    expect(result.constructor).toBe("value");
  });
});
