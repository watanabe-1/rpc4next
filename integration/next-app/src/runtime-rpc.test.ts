import { createRpcClient } from "rpc4next/client";
import { describe, expect, it } from "vitest";
import type { PathStructure } from "./generated/rpc";

type UrlExpectation = {
  path: string;
  relativePath: string;
  pathname: string;
  params: Record<string, string | string[] | undefined>;
};

type FetchCall = {
  input: RequestInfo | URL;
  init?: RequestInit;
};

const baseUrl = "http://127.0.0.1:3000";

describe("integration next-app generated PathStructure runtime behavior", () => {
  describe("$url", () => {
    const client = createRpcClient<PathStructure>(baseUrl);

    const cases: Array<{
      name: string;
      actual: () => UrlExpectation;
      expected: UrlExpectation;
    }> = [
      {
        name: "dynamic API route with query",
        actual: () =>
          client.api.users._userId("demo-user").$url({
            query: { includePosts: "true" },
          }),
        expected: {
          path: `${baseUrl}/api/users/demo-user?includePosts=true`,
          relativePath: "/api/users/demo-user?includePosts=true",
          pathname: "/api/users/[userId]",
          params: { userId: "demo-user" },
        },
      },
      {
        name: "static API route",
        actual: () => client.api.posts.$url(),
        expected: {
          path: `${baseUrl}/api/posts`,
          relativePath: "/api/posts",
          pathname: "/api/posts",
          params: {},
        },
      },
      {
        name: "top-level static page route",
        actual: () => client.feed.$url(),
        expected: {
          path: `${baseUrl}/feed`,
          relativePath: "/feed",
          pathname: "/feed",
          params: {},
        },
      },
      {
        name: "nested dynamic page route",
        actual: () =>
          client.photo._id("photo-1").comments._commentId("c-9").$url(),
        expected: {
          path: `${baseUrl}/photo/photo-1/comments/c-9`,
          relativePath: "/photo/photo-1/comments/c-9",
          pathname: "/photo/[id]/comments/[commentId]",
          params: { id: "photo-1", commentId: "c-9" },
        },
      },
      {
        name: "catch-all page route",
        actual: () =>
          client.patterns["catch-all"].___parts(["alpha", "beta"]).$url(),
        expected: {
          path: `${baseUrl}/patterns/catch-all/alpha/beta`,
          relativePath: "/patterns/catch-all/alpha/beta",
          pathname: "/patterns/catch-all/[...parts]",
          params: { parts: ["alpha", "beta"] },
        },
      },
      {
        name: "single dynamic page route",
        actual: () => client.patterns.dynamic._category("hello-world").$url(),
        expected: {
          path: `${baseUrl}/patterns/dynamic/hello-world`,
          relativePath: "/patterns/dynamic/hello-world",
          pathname: "/patterns/dynamic/[category]",
          params: { category: "hello-world" },
        },
      },
      {
        name: "nested dynamic page route under patterns",
        actual: () =>
          client.patterns.dynamic._category("books")._item("ts-guide").$url(),
        expected: {
          path: `${baseUrl}/patterns/dynamic/books/ts-guide`,
          relativePath: "/patterns/dynamic/books/ts-guide",
          pathname: "/patterns/dynamic/[category]/[item]",
          params: { category: "books", item: "ts-guide" },
        },
      },
      {
        name: "dynamic page route with encoded params",
        actual: () =>
          client.patterns.dynamic
            ._category("sci fi")
            ._item("a/b")
            .$url({ hash: "section-1" }),
        expected: {
          path: `${baseUrl}/patterns/dynamic/sci%20fi/a%2Fb#section-1`,
          relativePath: "/patterns/dynamic/sci%20fi/a%2Fb#section-1",
          pathname: "/patterns/dynamic/[category]/[item]",
          params: { category: "sci fi", item: "a/b" },
        },
      },
      {
        name: "optional catch-all page route with segments",
        actual: () =>
          client.patterns["optional-catch-all"]
            ._____parts(["one", "two"])
            .$url(),
        expected: {
          path: `${baseUrl}/patterns/optional-catch-all/one/two`,
          relativePath: "/patterns/optional-catch-all/one/two",
          pathname: "/patterns/optional-catch-all/[[...parts]]",
          params: { parts: ["one", "two"] },
        },
      },
      {
        name: "grouped route flattened into public URL",
        actual: () => client.patterns.reports.$url(),
        expected: {
          path: `${baseUrl}/patterns/reports`,
          relativePath: "/patterns/reports",
          pathname: "/patterns/reports",
          params: {},
        },
      },
    ];

    for (const testCase of cases) {
      it(`builds ${testCase.name}`, () => {
        expect(testCase.actual()).toEqual(testCase.expected);
      });
    }

    it("should allow optional catch-all page routes without segments", () => {
      expect(client.patterns["optional-catch-all"]._____parts().$url()).toEqual(
        {
          path: `${baseUrl}/patterns/optional-catch-all`,
          relativePath: "/patterns/optional-catch-all",
          pathname: "/patterns/optional-catch-all/[[...parts]]",
          params: { parts: undefined },
        },
      );
    });

    it("should treat escaped underscore folders as static page routes", () => {
      expect(client.patterns["%5Fescaped"].$url()).toEqual({
        path: `${baseUrl}/patterns/_escaped`,
        relativePath: "/patterns/_escaped",
        pathname: "/patterns/_escaped",
        params: {},
      });
    });

    it("should preserve malformed encoded static segments as raw page routes", () => {
      expect(client.patterns["%E3%81%ZZ"].$url()).toEqual({
        path: `${baseUrl}/patterns/%E3%81%ZZ`,
        relativePath: "/patterns/%E3%81%ZZ",
        pathname: "/patterns/%E3%81%ZZ",
        params: {},
      });
    });

    it("should hide internal branches while exposing flattened parallel public routes", () => {
      expect("_private" in client.patterns).toBe(false);
      expect("@analytics" in client.patterns.parallel).toBe(false);
      expect("@team" in client.patterns.parallel).toBe(false);
      expect("@modal" in client.feed).toBe(false);
      expect("@drilldown" in client.feed).toBe(false);

      expect(client.patterns.parallel.views.$url()).toEqual({
        path: `${baseUrl}/patterns/parallel/views`,
        relativePath: "/patterns/parallel/views",
        pathname: "/patterns/parallel/views",
        params: {},
      });
      expect(client.patterns.parallel.members.$url()).toEqual({
        path: `${baseUrl}/patterns/parallel/members`,
        relativePath: "/patterns/parallel/members",
        pathname: "/patterns/parallel/members",
        params: {},
      });
    });
  });

  describe("fetch", () => {
    it("calls GET against the generated dynamic API route", async () => {
      const calls: FetchCall[] = [];
      const client = createRpcClient<PathStructure>(baseUrl, {
        fetch: async (input, init) => {
          calls.push({ input, init });
          return new Response(JSON.stringify({ ok: true }), {
            status: 200,
            headers: { "content-type": "application/json" },
          });
        },
      });

      const response = await client.api.users
        ._userId("smoke-user")
        .$get({ url: { query: { includePosts: "false" } } });

      expect(response.status).toBe(200);
      expect(calls).toHaveLength(1);
      expect(String(calls[0]?.input)).toBe(
        `${baseUrl}/api/users/smoke-user?includePosts=false`,
      );
      expect(calls[0]?.init?.method).toBe("GET");
    });

    it("encodes dynamic API params before issuing GET requests", async () => {
      const calls: FetchCall[] = [];
      const client = createRpcClient<PathStructure>(baseUrl, {
        fetch: async (input, init) => {
          calls.push({ input, init });
          return new Response(JSON.stringify({ ok: true }), {
            status: 200,
            headers: { "content-type": "application/json" },
          });
        },
      });

      const response = await client.api.users
        ._userId("user with/slash")
        .$get({ url: { query: { includePosts: "true" } } });

      expect(response.status).toBe(200);
      expect(calls).toHaveLength(1);
      expect(String(calls[0]?.input)).toBe(
        `${baseUrl}/api/users/user%20with%2Fslash?includePosts=true`,
      );
      expect(calls[0]?.init?.method).toBe("GET");
    });

    it("calls POST against the generated static API route with JSON body", async () => {
      const calls: FetchCall[] = [];
      const client = createRpcClient<PathStructure>(baseUrl, {
        fetch: async (input, init) => {
          calls.push({ input, init });
          return new Response(JSON.stringify({ ok: true }), {
            status: 201,
            headers: { "content-type": "application/json" },
          });
        },
      });

      const response = await client.api.posts.$post({
        body: { json: { title: "runtime test" } },
      });

      expect(response.status).toBe(201);
      expect(calls).toHaveLength(1);
      expect(String(calls[0]?.input)).toBe(`${baseUrl}/api/posts`);
      expect(calls[0]?.init?.method).toBe("POST");
      expect(calls[0]?.init?.body).toBe('{"title":"runtime test"}');
    });
  });
});
