import { describe, expect, it } from "vitest";

import { createUrl } from "./url";

describe("createUrl", () => {
  it.each([".", ".."])('rejects dynamic segment "%s" before URL normalization', (value) => {
    expect(new URL(`https://example.com/users/${value}/profile`).pathname).not.toBe(
      `/users/${value}/profile`,
    );
    expect(() =>
      createUrl(["https://example.com", "users", "_id", "profile"], { _id: value }, ["_id"]),
    ).toThrow(`Invalid dynamic parameter "id": path segments cannot be "." or "..".`);
  });

  it.each(["___slug", "_____slug"])("rejects dot segments in %s arrays", (key) => {
    for (const value of [".", ".."]) {
      for (const parts of [
        [value, "safe"],
        ["safe", value],
        ["safe", value, "more"],
      ]) {
        expect(() => createUrl(["", "docs", key], { [key]: parts }, [key])).toThrow(
          'Invalid dynamic parameter "slug": path segments cannot be "." or "..".',
        );
      }
    }
  });

  it.each(["_id", "___id", "_____id"])("preserves ordinary values in %s", (key) => {
    const values = ["a.b", "...", "%2e", "a/b", "a b"];
    const param = key === "_id" ? values.join("/") : values;
    const result = createUrl(["", "items", key], { [key]: param }, [key])();

    expect(result.relativePath).toBe(
      key === "_id"
        ? "/items/a.b%2F...%2F%252e%2Fa%2Fb%2Fa%20b"
        : "/items/a.b/.../%252e/a%2Fb/a%20b",
    );
  });

  it.each([
    ["a#b", "a%23b", "a#b"],
    ["a?b", "a%3Fb", "a?b"],
    ["100%", "100%25", "100%"],
    ["a b", "a%20b", "a b"],
    ["日本語", "%E6%97%A5%E6%9C%AC%E8%AA%9E", "日本語"],
    ["a/b", "a%2Fb", "a/b"],
    ["a%2fb", "a%2fb", "a/b"],
    ["a%23b", "a%23b", "a#b"],
    ["a%2523b", "a%2523b", "a%23b"],
    ["%61%20b", "a%20b", "a b"],
    ["%E0%A4%A", "%E0%A4%A", "%E0%A4%A"],
    ["%25%E3%ZZ", "%25%E3%ZZ", "%25%E3%ZZ"],
  ])("encodes static key %s without changing URL metadata", (key, encoded, pathname) => {
    const result = createUrl(
      ["https://example.com/base", "static", key],
      {},
      [],
    )({
      query: { q: "value" },
      hash: "section",
    });

    expect(result).toEqual({
      path: `https://example.com/base/static/${encoded}?q=value#section`,
      relativePath: `/static/${encoded}?q=value#section`,
      pathname: `/static/${pathname}`,
      params: {},
    });
  });

  it.each([
    { key: "__id", value: "abc", name: "_id", pathname: "[_id]", path: "/users/abc" },
    {
      key: "____slug",
      value: ["a/b", "c"],
      name: "_slug",
      pathname: "[..._slug]",
      path: "/users/a%2Fb/c",
    },
    {
      key: "______slug",
      value: ["a/b", "c"],
      name: "_slug",
      pathname: "[[..._slug]]",
      path: "/users/a%2Fb/c",
    },
    {
      key: "______slug",
      value: undefined,
      name: "_slug",
      pathname: "[[..._slug]]",
      path: "/users",
    },
  ])("preserves the parameter name for $key ($path)", ({ key, value, name, pathname, path }) => {
    const result = createUrl(["", "users", key], { [key]: value }, [key])();

    expect(result.params).toEqual({ [name]: value });
    expect(result.pathname).toBe(`/users/${pathname}`);
    expect(result.relativePath).toBe(path);
  });

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

  it("does not mutate path segments and keeps repeated builder calls stable", () => {
    const paths = ["https://example.com", "user", "_id", "profile"];
    const urlGenerator = createUrl(paths, { _id: "123" }, ["_id"]);

    expect(urlGenerator().relativePath).toBe("/user/123/profile");
    expect(urlGenerator({ query: { page: "2" } })).toEqual({
      path: "https://example.com/user/123/profile?page=2",
      relativePath: "/user/123/profile?page=2",
      pathname: "/user/[id]/profile",
      params: { id: "123" },
    });
    expect(paths).toEqual(["https://example.com", "user", "_id", "profile"]);
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

  it("encodes hash characters that would otherwise change URL structure", () => {
    const result = createUrl(
      ["https://example.com", "docs"],
      {},
      [],
    )({
      hash: "日本語 section#1?tab=api",
    });

    expect(result.relativePath).toBe("/docs#%E6%97%A5%E6%9C%AC%E8%AA%9E%20section%231%3Ftab%3Dapi");
    expect(result.path).toBe(
      "https://example.com/docs#%E6%97%A5%E6%9C%AC%E8%AA%9E%20section%231%3Ftab%3Dapi",
    );
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

  it("does not decode an encoded slash in a static segment into a path separator", () => {
    const result = createUrl(["https://example.com", "patterns", "%2F"], {}, [])();

    expect(result.relativePath).toBe("/patterns/%2F");
    expect(result.path).toBe("https://example.com/patterns/%2F");
  });

  it("does not decode an encoded question mark in a static segment into a query marker", () => {
    const result = createUrl(["https://example.com", "patterns", "%3F"], {}, [])();

    expect(result.relativePath).toBe("/patterns/%3F");
    expect(result.path).toBe("https://example.com/patterns/%3F");
  });

  it("does not decode an encoded hash in a static segment into a fragment marker", () => {
    const result = createUrl(["https://example.com", "patterns", "%23"], {}, [])();

    expect(result.relativePath).toBe("/patterns/%23");
    expect(result.path).toBe("https://example.com/patterns/%23");
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

  it("keeps prototype-like params as data properties", () => {
    const urlGenerator = createUrl(
      ["https://example.com", "items", "_constructor"],
      { _constructor: "value" },
      ["_constructor"],
    );
    const result = urlGenerator();

    expect(Object.getPrototypeOf(result.params)).toBeNull();
    expect(result.params.constructor).toBe("value");
  });
});
