import { describe, expect, expectTypeOf, it } from "vitest";

import type {
  PageRouteMarker,
  ParamsKey,
  RpcEndpoint,
  RpcGeneratedPathStructure,
} from "./generated";
import {
  createRpcTestClient,
  createRpcTestPageClient,
  type RpcTestPage,
  type RpcTestPageHandler,
} from "./test";

const loadTestPage = (page: RpcTestPageHandler) => async () => ({ default: page });

const pageWithQuery = async (_props: {
  searchParams?: Promise<{ q?: string; tag?: string | string[] }>;
}) => undefined;
const pageWithResult = async () => ({ route: "typed" as const });

type TestPathStructure = RpcGeneratedPathStructure<{
  feed: RpcEndpoint;
  missing: RpcEndpoint;
  search: PageRouteMarker<typeof pageWithQuery> & RpcEndpoint;
  typed: PageRouteMarker<typeof pageWithResult> & RpcEndpoint;
  photo: {
    _id: RpcEndpoint & Record<ParamsKey, { id: string }>;
  };
  docs: {
    ___parts: RpcEndpoint & Record<ParamsKey, { parts: string[] }>;
    optional: {
      _____parts: RpcEndpoint & Record<ParamsKey, { parts: string[] | undefined }>;
    };
  };
}>;

describe.each(["route", "page"] as const)("%s test client route params", (clientKind) => {
  const pathnames = ["/photo/[id]", "/docs/[...parts]", "/docs/optional/[[...parts]]"];
  const client =
    clientKind === "route"
      ? createRpcTestClient<TestPathStructure>(
          pathnames.map((pathname) => ({
            pathname,
            methods: ["GET"],
            load: async () => ({
              GET: async (_request, { params }) => Response.json(await params),
            }),
          })),
        )
      : createRpcTestPageClient<TestPathStructure>(
          pathnames.map((pathname) => ({
            pathname,
            load: loadTestPage(async ({ params }) => params),
          })),
        );

  const call = async (endpoint: unknown) => {
    if (clientKind === "page") {
      return (endpoint as { $render: () => Promise<unknown> }).$render();
    }

    const response = await (endpoint as { $get: () => Promise<Response> }).$get();
    expect(response.status).toBe(200);

    return response.json();
  };

  it.each(["a", "a/b"])("keeps dynamic params as strings: %s", async (id) => {
    expect(await call(client.photo._id(id))).toEqual({ id });
  });

  it.each<{ parts: [string, ...string[]] }>([
    { parts: ["a"] },
    { parts: ["a", "b"] },
    { parts: ["a/b"] },
    { parts: ["a/b", "c%2Fd"] },
  ])("keeps catch-all params as arrays: $parts", async ({ parts }) => {
    expect(await call(client.docs.___parts(parts))).toEqual({ parts });
  });

  it.each<{ parts?: string[] }>([
    {},
    { parts: ["a"] },
    { parts: ["a", "b"] },
    { parts: ["a/b"] },
    { parts: ["a/b", "c%2Fd"] },
  ])("infers optional catch-all params: $parts", async ({ parts }) => {
    const result = await call(client.docs.optional._____parts(parts));
    // JSON omits undefined properties in route responses.
    expect(result).toEqual(clientKind === "route" && parts === undefined ? {} : { parts });
  });
});

describe.each(["route", "page"] as const)("%s test client static encoding", (clientKind) => {
  type EncodingPathStructure = RpcGeneratedPathStructure<
    Record<string, RpcEndpoint & { _id: RpcEndpoint; ___parts: RpcEndpoint; b: RpcEndpoint }>
  >;

  const createClient = (pathnames: string[]) =>
    clientKind === "route"
      ? createRpcTestClient<EncodingPathStructure>(
          pathnames.map((pathname) => ({
            pathname,
            methods: ["GET"],
            load: async () => ({
              GET: async (_request, { params }) =>
                Response.json({ pathname, params: await params }),
            }),
          })),
        )
      : createRpcTestPageClient<EncodingPathStructure>(
          pathnames.map((pathname) => ({
            pathname,
            load: loadTestPage(async ({ params }) => ({ pathname, params: await params })),
          })),
        );

  const call = async (endpoint: unknown) => {
    if (clientKind === "page") {
      return (endpoint as { $render: () => Promise<unknown> }).$render();
    }

    const response = await (endpoint as { $get: () => Promise<Response> }).$get();
    expect(response.status).toBe(200);

    return response.json();
  };

  it.each([
    ["日本語", "日本語"],
    ["日本語", "%e6%97%a5%e6%9c%ac%e8%aa%9e"],
    ["%E6%97%A5%E6%9C%AC%E8%AA%9E", "日本語"],
    ["hello world", "hello world"],
    ["hello%20world", "hello world"],
    ["a%2fb", "a%2Fb"],
    ["%E3%81%ZZ", "%E3%81%ZZ"],
    ["%E0%A4%A", "%E0%A4%A"],
    ["100%", "100%25"],
    ["a.b+(c)$^!", "a.b+(c)$^!"],
  ])("matches manifest segment %s against client key %s", async (segment, key) => {
    const pathname = `/${segment}`;
    const client = createClient([pathname]);
    expect(await call(client[key])).toEqual({ pathname, params: {} });
  });

  it("keeps encoded slashes distinct from path separators", async () => {
    const client = createClient(["/a/b", "/a%2Fb"]);
    expect(await call(client["a%2Fb"])).toEqual({ pathname: "/a%2Fb", params: {} });
    expect(await call(client.a.b)).toEqual({ pathname: "/a/b", params: {} });
  });

  it.each(["日本語", "a b", "a/b", "%2F", "%E3%81%ZZ"])(
    "decodes dynamic values once under a static Japanese segment: %s",
    async (id) => {
      const client = createClient(["/日本語/[id]"]);
      expect(await call(client["日本語"]._id(id))).toEqual({
        pathname: "/日本語/[id]",
        params: { id },
      });
    },
  );

  it("preserves malformed dynamic encodings as raw values", async () => {
    const client = createClient(["/[id]"]);
    expect(await call(client["%E3%81%ZZ"])).toEqual({
      pathname: "/[id]",
      params: { id: "%E3%81%ZZ" },
    });
  });

  it("decodes catch-all values within each segment under a static Japanese segment", async () => {
    const client = createClient(["/日本語/[...parts]"]);
    const parts: [string, ...string[]] = ["a/b", "%2F", "日本語", "%E3%81%ZZ"];
    expect(await call(client["日本語"].___parts(parts))).toEqual({
      pathname: "/日本語/[...parts]",
      params: { parts },
    });
  });

  it("prioritizes normalized static segments over dynamic routes", async () => {
    const client = createClient(["/[id]", "/日本語"]);
    expect(await call(client["日本語"])).toEqual({ pathname: "/日本語", params: {} });
  });

  it("escapes regex metacharacters in static segments", async () => {
    const client = createClient(["/a.b", "/[id]"]);
    expect(await call(client["a.b"])).toEqual({ pathname: "/a.b", params: {} });
    expect(await call(client.axb)).toEqual({ pathname: "/[id]", params: { id: "axb" } });
  });
});

describe("createRpcTestPageClient", () => {
  it("renders a matching static page", async () => {
    const pageClient = createRpcTestPageClient<TestPathStructure>([
      {
        pathname: "/feed",
        load: loadTestPage(async ({ params }) => ({
          route: "feed",
          params: await params,
        })),
      },
    ]);

    await expect(pageClient.feed.$render()).resolves.toEqual({
      route: "feed",
      params: {},
    });
  });

  it("infers dynamic params from the pathname", async () => {
    const pageClient = createRpcTestPageClient<TestPathStructure>([
      {
        pathname: "/photo/[id]",
        load: loadTestPage(async ({ params }) => params),
      },
    ]);

    await expect(pageClient.photo._id("photo-1").$render()).resolves.toEqual({
      id: "photo-1",
    });
  });

  it("infers catch-all and optional catch-all params", async () => {
    const catchAllPage: RpcTestPage = {
      pathname: "/docs/[...parts]",
      load: loadTestPage(async ({ params }) => params),
    };
    const optionalCatchAllPage: RpcTestPage = {
      pathname: "/docs/optional/[[...parts]]",
      load: loadTestPage(async ({ params }) => params),
    };
    const pageClient = createRpcTestPageClient<TestPathStructure>([
      catchAllPage,
      optionalCatchAllPage,
    ]);

    await expect(pageClient.docs.___parts(["a", "b"]).$render()).resolves.toEqual({
      parts: ["a", "b"],
    });
    await expect(pageClient.docs.optional._____parts().$render()).resolves.toEqual({
      parts: undefined,
    });
    await expect(pageClient.docs.optional._____parts(["a", "b"]).$render()).resolves.toEqual({
      parts: ["a", "b"],
    });
  });

  it("converts query strings to the Next page searchParams shape", async () => {
    const pageClient = createRpcTestPageClient<TestPathStructure>([
      {
        pathname: "/search",
        load: loadTestPage(async ({ searchParams }) => searchParams),
      },
    ]);

    await expect(
      pageClient.search.$render({
        url: { query: { q: "rpc4next", tag: ["one", "two"] } },
      }),
    ).resolves.toEqual({
      q: "rpc4next",
      tag: ["one", "two"],
    });
  });

  it("throws a clear error when no page matches", async () => {
    const pageClient = createRpcTestPageClient<TestPathStructure>([
      {
        pathname: "/feed",
        load: loadTestPage(() => "feed"),
      },
    ]);

    await expect(pageClient.missing.$render()).rejects.toThrow(
      'No rpc4next test page matched "/missing".',
    );
  });

  it("infers the generated page return type for render results", () => {
    const pageClient = createRpcTestPageClient<TestPathStructure>([
      {
        pathname: "/typed",
        load: loadTestPage(pageWithResult),
      },
    ]);

    expectTypeOf(pageClient.typed.$render()).toEqualTypeOf<Promise<{ route: "typed" }>>();
  });
});
