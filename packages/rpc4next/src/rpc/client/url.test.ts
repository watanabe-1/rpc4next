import { describe, expect, it } from "vitest";
import { createUrl } from "./url";

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

  it("appends only a hash when provided", () => {
    const result = createUrl(
      ["https://example.com", "docs"],
      {},
      [],
    )({
      hash: "section1",
    });

    expect(result.relativePath).toBe("/docs#section1");
    expect(result.path).toBe("https://example.com/docs#section1");
  });

  it("appends query parameters and hash when both are provided", () => {
    const result = createUrl(
      ["https://example.com", "search"],
      {},
      [],
    )({
      query: { foo: "bar", baz: "qux" },
      hash: "filters",
    });

    expect(result.relativePath.startsWith("/search?")).toBe(true);
    expect(result.relativePath).toContain("foo=bar");
    expect(result.relativePath).toContain("baz=qux");
    expect(result.relativePath).toContain("#filters");
  });

  it("serializes array query values as repeated keys", () => {
    const result = createUrl(
      ["https://example.com", "search"],
      {},
      [],
    )({
      query: { tag: ["a", "b"] },
    });

    expect(result.relativePath).toBe("/search?tag=a&tag=b");
    expect(result.path).toBe("https://example.com/search?tag=a&tag=b");
  });

  it("omits undefined query values", () => {
    const result = createUrl(
      ["https://example.com", "search"],
      {},
      [],
    )({
      query: { tag: undefined, q: "term" },
    });

    expect(result.relativePath).toBe("/search?q=term");
    expect(result.path).toBe("https://example.com/search?q=term");
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

  it("generates a URL without optional catch-all segments when the parameter is undefined", () => {
    const paths = ["https://example.com", "user", "_____ids"];
    const params = { _____ids: undefined };
    const expectedParams = { ids: undefined };
    const dynamicKeys = ["_____ids"];
    const urlGenerator = createUrl(paths, params, dynamicKeys);
    const result = urlGenerator();

    expect(result.relativePath).toBe("/user");
    expect(result.path).toBe("https://example.com/user");
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

  it("decodes encoded static segments without treating them as dynamic", () => {
    const paths = ["https://example.com", "patterns", "%5Fescaped"];
    const urlGenerator = createUrl(paths, {}, []);
    const result = urlGenerator();

    expect(result.relativePath).toBe("/patterns/_escaped");
    expect(result.path).toBe("https://example.com/patterns/_escaped");
    expect(result.pathname).toBe("/patterns/_escaped");
  });

  it("keeps malformed encoded static segments as raw values", () => {
    const paths = ["https://example.com", "patterns", "%E3%81%ZZ"];
    const urlGenerator = createUrl(paths, {}, []);
    const result = urlGenerator();

    expect(result.relativePath).toBe("/patterns/%E3%81%ZZ");
    expect(result.path).toBe("https://example.com/patterns/%E3%81%ZZ");
    expect(result.pathname).toBe("/patterns/%E3%81%ZZ");
  });

  it("builds the root path when there are no route segments", () => {
    const urlGenerator = createUrl(["https://example.com"], {}, []);
    const result = urlGenerator();

    expect(result.relativePath).toBe("/");
    expect(result.path).toBe("https://example.com/");
    expect(result.pathname).toBe("/");
  });
});
