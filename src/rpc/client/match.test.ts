import { describe, it, expect } from "vitest";
import { matchPath } from "./match";

describe("matchPath", () => {
  describe("Dynamic segments", () => {
    it("Simple dynamic segment (without trailing slash)", () => {
      const paths = ["/", "users", "_id"];
      const dynamicKeys = ["_id"];
      const matcher = matchPath(paths, dynamicKeys);
      expect(matcher("/users/123")).toEqual({
        params: { id: "123" },
        query: {},
        hash: undefined,
      });
      expect(
        matcher("/users/%E3%81%93%E3%82%93%E3%81%AB%E3%81%A1%E3%81%AF")
      ).toEqual({
        params: { id: "こんにちは" },
        query: {},
        hash: undefined,
      });
    });

    it("Simple dynamic segment (with trailing slash)", () => {
      const paths = ["/", "users", "_id"];
      const dynamicKeys = ["_id"];
      const matcher = matchPath(paths, dynamicKeys);
      expect(matcher("/users/123/")).toEqual({
        params: { id: "123" },
        query: {},
        hash: undefined,
      });
    });
  });

  describe("Catch-all segments", () => {
    it("Catch-all segment (without trailing slash)", () => {
      const paths = ["/", "blog", "___slug"];
      const dynamicKeys = ["___slug"];
      const matcher = matchPath(paths, dynamicKeys);
      expect(matcher("/blog/2020/10/01")).toEqual({
        params: { slug: ["2020", "10", "01"] },
        query: {},
        hash: undefined,
      });
    });

    it("Catch-all segment (with trailing slash)", () => {
      const paths = ["/", "blog", "___slug"];
      const dynamicKeys = ["___slug"];
      const matcher = matchPath(paths, dynamicKeys);
      expect(matcher("/blog/2020/10/01/")).toEqual({
        params: { slug: ["2020", "10", "01"] },
        query: {},
        hash: undefined,
      });
    });
  });

  describe("Optional catch-all segments", () => {
    it("Optional catch-all segment (no parameter, without trailing slash)", () => {
      const paths = ["/", "blog", "_____slug"];
      const dynamicKeys = ["_____slug"];
      const matcher = matchPath(paths, dynamicKeys);
      expect(matcher("/blog")).toEqual({
        params: { slug: undefined },
        query: {},
        hash: undefined,
      });
    });

    it("Optional catch-all segment (no parameter, with trailing slash)", () => {
      const paths = ["/", "blog", "_____slug"];
      const dynamicKeys = ["_____slug"];
      const matcher = matchPath(paths, dynamicKeys);
      expect(matcher("/blog/")).toEqual({
        params: { slug: undefined },
        query: {},
        hash: undefined,
      });
    });

    it("Optional catch-all segment (with parameter, without trailing slash)", () => {
      const paths = ["/", "blog", "_____slug"];
      const dynamicKeys = ["_____slug"];
      const matcher = matchPath(paths, dynamicKeys);
      expect(matcher("/blog/2021/05")).toEqual({
        params: { slug: ["2021", "05"] },
        query: {},
        hash: undefined,
      });
      expect(
        matcher("/blog/%E3%81%93%E3%82%93%E3%81%AB%E3%81%A1%E3%81%AF/05")
      ).toEqual({
        params: { slug: ["こんにちは", "05"] },
        query: {},
        hash: undefined,
      });
    });

    it("Optional catch-all segment (with parameter, with trailing slash)", () => {
      const paths = ["/", "blog", "_____slug"];
      const dynamicKeys = ["_____slug"];
      const matcher = matchPath(paths, dynamicKeys);
      expect(matcher("/blog/2021/05/")).toEqual({
        params: { slug: ["2021", "05"] },
        query: {},
        hash: undefined,
      });
    });
  });

  describe("Combined patterns", () => {
    it("Multiple patterns (combination of dynamic segment and optional catch-all) (without trailing slash)", () => {
      const paths = ["/", "users", "_id", "posts", "_____optional"];
      const dynamicKeys = ["_id", "_____optional"];
      const matcher = matchPath(paths, dynamicKeys);
      expect(matcher("/users/42/posts/alpha/beta")).toEqual({
        params: { id: "42", optional: ["alpha", "beta"] },
        query: {},
        hash: undefined,
      });
      expect(matcher("/users/42/posts")).toEqual({
        params: { id: "42", optional: undefined },
        query: {},
        hash: undefined,
      });
    });

    it("Multiple patterns (combination of dynamic segment and optional catch-all) (with trailing slash)", () => {
      const paths = ["/", "users", "_id", "posts", "_____optional"];
      const dynamicKeys = ["_id", "_____optional"];
      const matcher = matchPath(paths, dynamicKeys);
      expect(matcher("/users/42/posts/alpha/beta/")).toEqual({
        params: { id: "42", optional: ["alpha", "beta"] },
        query: {},
        hash: undefined,
      });
      expect(matcher("/users/42/posts/")).toEqual({
        params: { id: "42", optional: undefined },
        query: {},
        hash: undefined,
      });
    });
  });

  describe("Unmatched cases", () => {
    it("Returns null for unmatched paths", () => {
      const paths = ["/", "users", "_id"];
      const dynamicKeys = ["_id"];
      const matcher = matchPath(paths, dynamicKeys);
      expect(matcher("/users")).toBeNull();
    });
  });

  describe("Query and hash support", () => {
    const paths = ["/", "users", "_id"];
    const dynamicKeys = ["_id"];
    const matcher = matchPath(paths, dynamicKeys);

    it("Parses query parameters", () => {
      expect(matcher("/users/123?a=1&b=hello")).toEqual({
        params: { id: "123" },
        query: { a: "1", b: "hello" },
        hash: undefined,
      });
    });

    it("Parses hash fragment", () => {
      expect(matcher("/users/123#top")).toEqual({
        params: { id: "123" },
        query: {},
        hash: "top",
      });
    });

    it("Parses both query and hash", () => {
      expect(matcher("/users/123?a=1&b=2#section2")).toEqual({
        params: { id: "123" },
        query: { a: "1", b: "2" },
        hash: "section2",
      });
    });

    it("Decodes query and hash", () => {
      expect(
        matcher(
          "/users/%E3%81%93%E3%82%93%E3%81%AB%E3%81%A1%E3%81%AF?x=%E3%83%86%E3%82%B9%E3%83%88#%E3%83%8F%E3%83%83%E3%82%B7%E3%83%A5"
        )
      ).toEqual({
        params: { id: "こんにちは" },
        query: { x: "テスト" },
        hash: "ハッシュ",
      });
    });

    it("Handles duplicated query keys as arrays", () => {
      expect(matcher("/users/1?a=1&a=2")).toEqual({
        params: { id: "1" },
        query: { a: ["1", "2"] },
        hash: undefined,
      });
    });
  });
});
