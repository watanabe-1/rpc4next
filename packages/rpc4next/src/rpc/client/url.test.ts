import { describe, it, expect } from "vitest";
import { buildUrlSuffix, replaceDynamicSegments, createUrl } from "./url";

describe("buildUrlSuffix", () => {
  it("returns an empty string when no URL is provided", () => {
    expect(buildUrlSuffix()).toBe("");
  });

  it("returns a query string when a query is provided", () => {
    const url = { query: { foo: "bar", baz: "qux" } };
    const result = buildUrlSuffix(url);
    // Since URLSearchParams does not guarantee parameter order,
    // verify that it starts with '?' and contains each parameter
    expect(result.startsWith("?")).toBe(true);
    expect(result).toContain("foo=bar");
    expect(result).toContain("baz=qux");
  });

  it("returns a hash string when a hash is provided", () => {
    const url = { hash: "section1" };
    expect(buildUrlSuffix(url)).toBe("#section1");
  });

  it("returns a combined query and hash string when both are provided", () => {
    const url = { query: { a: "1" }, hash: "section2" };
    const result = buildUrlSuffix(url);
    expect(result.startsWith("?")).toBe(true);
    expect(result).toContain("a=1");
    expect(result).toContain("#section2");
  });
});

describe("replaceDynamicSegments", () => {
  it("replaces dynamic segments with specified values", () => {
    const basePath = "/_____optional/___catch/_dynamic";
    const replacements = {
      optionalCatchAll: "/opt",
      catchAll: "/cat",
      dynamic: "/dyn",
    };
    const result = replaceDynamicSegments(basePath, replacements);
    expect(result).toBe("/opt/cat/dyn");
  });
});

describe("createUrl", () => {
  it("generates a URL with dynamic parameters and query/hash", () => {
    const paths = ["https://example.com", "user", "_id", "profile"];
    const params = { _id: "123" };
    const expectedParams = { id: "123" };
    const dynamicKeys = ["_id"];
    const urlGenerator = createUrl(paths, params, dynamicKeys);
    const result = urlGenerator({ query: { test: "value" }, hash: "section" });

    expect(result.relativePath).toContain("/user/123/profile");
    expect(result.relativePath).toContain("?");
    expect(result.relativePath).toContain("test=value");
    expect(result.relativePath).toContain("#section");
    expect(result.path).toBe(`https://example.com${result.relativePath}`);
    expect(result.params).toEqual(expectedParams);

    expect(result.pathname).toBe("/user/[id]/profile");
  });

  it("generates a URL with a catch-all parameter", () => {
    const paths = ["https://example.com", "user", "___ids"];
    const params = { ___ids: ["1", "2", "3"] };
    const expectedParams = { ids: ["1", "2", "3"] };
    const dynamicKeys = ["___ids"];
    const urlGenerator = createUrl(paths, params, dynamicKeys);
    const result = urlGenerator();

    expect(result.relativePath).toContain("/user/1/2/3");
    expect(result.path).toBe(`https://example.com${result.relativePath}`);
    expect(result.params).toEqual(expectedParams);

    expect(result.pathname).toBe("/user/[...ids]");
  });

  it("generates a URL with undefined catch-all parameter", () => {
    const paths = ["https://example.com", "user", "___ids"];
    const params = { ___ids: undefined };
    const expectedParams = { ids: undefined };
    const dynamicKeys = ["___ids"];
    const urlGenerator = createUrl(paths, params, dynamicKeys);
    const result = urlGenerator();

    expect(result.relativePath).toContain("/user");
    expect(result.path).toBe(`https://example.com${result.relativePath}`);
    expect(result.params).toEqual(expectedParams);

    expect(result.pathname).toBe("/user/[...ids]");
  });

  it("generates a URL with an empty catch-all parameter array", () => {
    const paths = ["https://example.com", "user", "___ids"];
    const params = { ___ids: [] };
    const expectedParams = { ids: [] };
    const dynamicKeys = ["___ids"];
    const urlGenerator = createUrl(paths, params, dynamicKeys);
    const result = urlGenerator();

    expect(result.relativePath).toContain("/user");
    expect(result.path).toBe(`https://example.com${result.relativePath}`);
    expect(result.params).toEqual(expectedParams);

    expect(result.pathname).toBe("/user/[...ids]");
  });

  it("generates a URL with optional catch-all parameter", () => {
    const paths = ["https://example.com", "user", "_____ids"];
    const params = { _____ids: ["1", "2", "3"] };
    const expectedParams = { ids: ["1", "2", "3"] };
    const dynamicKeys = ["_____ids"];
    const urlGenerator = createUrl(paths, params, dynamicKeys);
    const result = urlGenerator();

    expect(result.relativePath).toContain("/user/1/2/3");
    expect(result.path).toBe(`https://example.com${result.relativePath}`);
    expect(result.params).toEqual(expectedParams);

    expect(result.pathname).toBe("/user/[[...ids]]");
  });

  it("encodes array parameters and joins with slashes", () => {
    const paths = ["https://example.com", "items", "list"];
    const params = { list: ["a b", "c/d"] };
    const dynamicKeys = ["list"];
    const urlGenerator = createUrl(paths, params, dynamicKeys);
    const result = urlGenerator();
    expect(result.relativePath).toBe("/items/a%20b/c%2Fd");
  });

  it("removes segment when parameter is undefined", () => {
    const paths = ["https://example.com", "user", "id", "detail"];
    const params = { id: undefined };
    const dynamicKeys = ["id"];
    const urlGenerator = createUrl(paths, params, dynamicKeys);
    const result = urlGenerator();
    expect(result.relativePath).toBe("/user/detail");
  });

  it("handles trailing slash in base URL correctly", () => {
    const paths = ["https://example.com/", "_group", "user", "___ids"];
    const params = { _group: "test", ___ids: ["1", "2"] };
    const expectedParams = { group: "test", ids: ["1", "2"] };
    const dynamicKeys = ["_group", "___ids"];
    const urlGenerator = createUrl(paths, params, dynamicKeys);
    const result = urlGenerator();

    expect(result.relativePath).toContain("/test/user/1/2");
    expect(result.path).toBe(`https://example.com${result.relativePath}`);
    expect(result.params).toEqual(expectedParams);

    expect(result.pathname).toBe("/[group]/user/[...ids]");
  });

  it("generates correct URL when the first path segment is empty", () => {
    const paths = ["", "_group", "user", "___ids"];
    const params = { _group: "test", ___ids: ["1", "2"] };
    const expectedParams = { group: "test", ids: ["1", "2"] };
    const dynamicKeys = ["_group", "___ids"];
    const urlGenerator = createUrl(paths, params, dynamicKeys);
    const result = urlGenerator();

    expect(result.relativePath).toContain("/test/user/1/2");
    expect(result.path).toBe(result.relativePath);
    expect(result.params).toEqual(expectedParams);

    expect(result.pathname).toBe("/[group]/user/[...ids]");
  });
});
