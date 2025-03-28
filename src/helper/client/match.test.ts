import { describe, it, expect } from "vitest";
import { matchPath } from "./match";

describe("matchPath", () => {
  // -------------------------------
  // Test for dynamic segments
  // -------------------------------
  it("Simple dynamic segment (without trailing slash)", () => {
    const paths = ["/", "users", "_id"];
    const dynamicKeys = ["_id"];
    const matcher = matchPath(paths, dynamicKeys);
    expect(matcher("/users/123")).toEqual({ id: "123" });
    expect(
      matcher("/users/%E3%81%93%E3%82%93%E3%81%AB%E3%81%A1%E3%81%AF")
    ).toEqual({ id: "こんにちは" });
  });

  it("Simple dynamic segment (with trailing slash)", () => {
    const paths = ["/", "users", "_id"];
    const dynamicKeys = ["_id"];
    const matcher = matchPath(paths, dynamicKeys);
    expect(matcher("/users/123/")).toEqual({ id: "123" });
  });

  // -------------------------------
  // Test for catch-all segments
  // -------------------------------
  it("Catch-all segment (without trailing slash)", () => {
    const paths = ["/", "blog", "___slug"];
    const dynamicKeys = ["___slug"];
    const matcher = matchPath(paths, dynamicKeys);
    expect(matcher("/blog/2020/10/01")).toEqual({
      slug: ["2020", "10", "01"],
    });
  });

  it("Catch-all segment (with trailing slash)", () => {
    const paths = ["/", "blog", "___slug"];
    const dynamicKeys = ["___slug"];
    const matcher = matchPath(paths, dynamicKeys);
    expect(matcher("/blog/2020/10/01/")).toEqual({
      slug: ["2020", "10", "01"],
    });
  });

  // -------------------------------
  // Test for optional catch-all segments
  // -------------------------------
  it("Optional catch-all segment (no parameter, without trailing slash)", () => {
    const paths = ["/", "blog", "_____slug"];
    const dynamicKeys = ["_____slug"];
    const matcher = matchPath(paths, dynamicKeys);
    expect(matcher("/blog")).toEqual({ slug: undefined });
  });

  it("Optional catch-all segment (no parameter, with trailing slash)", () => {
    const paths = ["/", "blog", "_____slug"];
    const dynamicKeys = ["_____slug"];
    const matcher = matchPath(paths, dynamicKeys);
    expect(matcher("/blog/")).toEqual({ slug: undefined });
  });

  it("Optional catch-all segment (with parameter, without trailing slash)", () => {
    const paths = ["/", "blog", "_____slug"];
    const dynamicKeys = ["_____slug"];
    const matcher = matchPath(paths, dynamicKeys);
    expect(matcher("/blog/2021/05")).toEqual({ slug: ["2021", "05"] });
    expect(
      matcher("/blog/%E3%81%93%E3%82%93%E3%81%AB%E3%81%A1%E3%81%AF/05")
    ).toEqual({ slug: ["こんにちは", "05"] });
  });

  it("Optional catch-all segment (with parameter, with trailing slash)", () => {
    const paths = ["/", "blog", "_____slug"];
    const dynamicKeys = ["_____slug"];
    const matcher = matchPath(paths, dynamicKeys);
    expect(matcher("/blog/2021/05/")).toEqual({ slug: ["2021", "05"] });
  });

  // -------------------------------
  // Test for combined patterns
  // -------------------------------
  it("Multiple patterns (combination of dynamic segment and optional catch-all) (without trailing slash)", () => {
    const paths = ["/", "users", "_id", "posts", "_____optional"];
    const dynamicKeys = ["_id", "_____optional"];
    const matcher = matchPath(paths, dynamicKeys);
    // When the optional catch-all part exists
    expect(matcher("/users/42/posts/alpha/beta")).toEqual({
      id: "42",
      optional: ["alpha", "beta"],
    });
    // When the optional catch-all part does not exist
    expect(matcher("/users/42/posts")).toEqual({
      id: "42",
      optional: undefined,
    });
  });

  it("Multiple patterns (combination of dynamic segment and optional catch-all) (with trailing slash)", () => {
    const paths = ["/", "users", "_id", "posts", "_____optional"];
    const dynamicKeys = ["_id", "_____optional"];
    const matcher = matchPath(paths, dynamicKeys);
    // When the optional catch-all part exists
    expect(matcher("/users/42/posts/alpha/beta/")).toEqual({
      id: "42",
      optional: ["alpha", "beta"],
    });
    // When the optional catch-all part does not exist
    expect(matcher("/users/42/posts/")).toEqual({
      id: "42",
      optional: undefined,
    });
  });

  // -------------------------------
  // Test for unmatched cases (insufficient path segments)
  // -------------------------------
  it("Returns null for unmatched paths", () => {
    const paths = ["/", "users", "_id"];
    const dynamicKeys = ["_id"];
    const matcher = matchPath(paths, dynamicKeys);
    // '/users' alone should not match because the id segment is missing
    expect(matcher("/users")).toBeNull();
  });
});
