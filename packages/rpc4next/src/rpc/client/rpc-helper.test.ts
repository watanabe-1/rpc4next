import type { HttpMethod } from "rpc4next-shared";
import * as v from "valibot";
import { describe, expect, expectTypeOf, it, vi } from "vitest";
import { z } from "zod";

import { procedure } from "../server";
import type { ProcedureRouteContract } from "../server/generated";
import { createNextRoute as basecreateNextRoute } from "../server/next-route";
import { defaultProcedureOnError } from "../server/on-error";
import type { ParamsKey, QueryKey, RpcEndpoint, RpcGeneratedPathStructure } from "./generated";
import { createRpcHelper, type StandardSchemaV1 } from "./rpc-helper";

const queryRouteContract = {
  pathname: "/api/query",
  params: {} as Record<never, never>,
} as ProcedureRouteContract<"/api/query", Record<never, never>>;

const createNextRoute = <
  TProcedure,
  TMethod extends HttpMethod = "GET",
  TValidateOutput extends boolean = false,
>(
  procedureDefinition: TProcedure,
  options?: {
    method?: TMethod;
    validateOutput?: TValidateOutput;
    onError?: unknown;
  },
) => {
  const method = options?.method ?? ("GET" as TMethod);
  const resolvedOptions =
    options && "onError" in options
      ? { ...options, method }
      : { ...options, method, onError: defaultProcedureOnError };

  const routes = basecreateNextRoute<
    TProcedure & Parameters<typeof basecreateNextRoute>[0],
    TMethod,
    TValidateOutput
  >(procedureDefinition as never, resolvedOptions as never);

  return routes[method];
};

const schema = z.object({
  name: z.string(),
  hoge: z.string(),
});

const getQuerySchema = z.object({
  page: z.string(),
});

const postQuerySchema = z.object({
  mode: z.enum(["draft", "published"]),
});

const _post_query = createNextRoute(
  procedure
    .forRoute(queryRouteContract)
    .query(schema)
    .handle(async ({ response }) => response.text("text")),
  { method: "POST" },
);

const _get_mixed_query = createNextRoute(
  procedure
    .forRoute(queryRouteContract)
    .query(getQuerySchema)
    .handle(async ({ response }) => response.text("text")),
  { method: "GET" },
);

const _post_mixed_query = createNextRoute(
  procedure
    .forRoute(queryRouteContract)
    .query(postQuerySchema)
    .handle(async ({ response }) => response.text("text")),
  { method: "POST" },
);

type PathStructure = RpcGeneratedPathStructure<
  RpcEndpoint & {
    fuga: RpcEndpoint & {
      _foo: RpcEndpoint &
        Record<ParamsKey, { foo: string }> & {
          _piyo: RpcEndpoint &
            Record<QueryKey, { baz: string }> &
            Record<ParamsKey, { foo: string; piyo: string }>;
        };
    };
    api: {
      query: { $post: typeof _post_query } & RpcEndpoint;
      mixedQuery: {
        $get: typeof _get_mixed_query;
        $post: typeof _post_mixed_query;
      } & RpcEndpoint;
    };
  }
>;

const rpcHelper = createRpcHelper<PathStructure>();

const emptySchema = z.object({});
const fooSchemas = { params: z.object({ foo: z.string() }), query: emptySchema };
const piyoSchemas = {
  params: z.object({ foo: z.string(), piyo: z.string() }),
  query: z.object({ baz: z.string() }),
};
const querySchemas = { params: emptySchema, query: schema };

describe("createRpcHelper validated matching", () => {
  it("matches and validates dynamic params", async () => {
    const match = await rpcHelper.fuga._foo.$match("/fuga/test", fooSchemas);
    expect(match).toEqual({ params: { foo: "test" }, query: {}, hash: undefined });
    expectTypeOf(match).toEqualTypeOf<{
      params: { foo: string };
      query: Record<string, never>;
      hash: string | undefined;
    } | null>();
  });

  it("validates generated page query markers and decodes hashes", async () => {
    const match = await rpcHelper.fuga._foo._piyo.$match(
      "/fuga/foo/bar?baz=value#hello%20world",
      piyoSchemas,
    );
    expect(match).toEqual({
      params: { foo: "foo", piyo: "bar" },
      query: { baz: "value" },
      hash: "hello world",
    });
    expectTypeOf(match?.query).toEqualTypeOf<{ baz: string } | undefined>();
    expect(await rpcHelper.fuga._foo._piyo.$match("/fuga/foo/bar", piyoSchemas)).toBeNull();
  });

  it("uses the same query schema as the procedure", async () => {
    const match = await rpcHelper.api.query.$match(
      "/api/query?name=test&hoge=aa#hash123",
      querySchemas,
    );
    expect(match).toEqual({
      params: {},
      query: { name: "test", hoge: "aa" },
      hash: "hash123",
    });
    if (!match) throw new Error("Expected match");
    expectTypeOf(match.query).toEqualTypeOf<{ name: string; hoge: string }>();
    expect(match.query.name.toUpperCase()).toBe("TEST");
  });

  it.each(["/api/query", "/api/query?hoge=aa", "/api/query?name=one&name=two&hoge=aa"])(
    "rejects missing or repeated required string fields: %s",
    async (url) => {
      expect(await rpcHelper.api.query.$match(url, querySchemas)).toBeNull();
    },
  );

  it("selects an explicit schema for routes with different method contracts", async () => {
    const getSchemas = { params: emptySchema, query: getQuerySchema };
    const postSchemas = { params: emptySchema, query: postQuerySchema };
    const getMatch = await rpcHelper.api.mixedQuery.$match("/api/mixedQuery?page=1", getSchemas);
    const postMatch = await rpcHelper.api.mixedQuery.$match(
      "/api/mixedQuery?mode=draft",
      postSchemas,
    );
    expect(getMatch?.query).toEqual({ page: "1" });
    expect(postMatch?.query).toEqual({ mode: "draft" });
    expectTypeOf(getMatch?.query).toEqualTypeOf<{ page: string } | undefined>();
    expectTypeOf(postMatch?.query).toEqualTypeOf<{ mode: "draft" | "published" } | undefined>();
    expect(
      await rpcHelper.api.mixedQuery.$match("/api/mixedQuery?mode=other", postSchemas),
    ).toBeNull();
    expect(await rpcHelper.api.mixedQuery.$match("/api/mixedQuery?page=1", postSchemas)).toBeNull();
  });

  it("returns schema outputs including transformed params and query defaults", async () => {
    const schemas = {
      params: z.object({ foo: z.string().regex(/^\d+$/).transform(Number) }),
      query: z.object({ page: z.string().default("1").transform(Number) }),
    };
    const match = await rpcHelper.fuga._foo.$match("/fuga/42", schemas);
    expect(match).toEqual({ params: { foo: 42 }, query: { page: 1 }, hash: undefined });
    expectTypeOf(match?.params).toEqualTypeOf<{ foo: number } | undefined>();
    expectTypeOf(match?.query).toEqualTypeOf<{ page: number } | undefined>();
    expect(await rpcHelper.fuga._foo.$match("/fuga/invalid", schemas)).toBeNull();
  });

  it("preserves repeated values for schemas that accept arrays", async () => {
    const schemas = { params: emptySchema, query: z.object({ tag: z.array(z.string()) }) };
    const match = await rpcHelper.api.query.$match("/api/query?tag=a%2Fb&tag=c", schemas);
    expect(match?.query).toEqual({ tag: ["a/b", "c"] });
    expect(await rpcHelper.api.query.$match("/api/query?tag=a", schemas)).toBeNull();
  });

  it("applies the schema policy to unknown query keys", async () => {
    const url = "/api/query?name=test&hoge=aa&extra=value";
    expect((await rpcHelper.api.query.$match(url, querySchemas))?.query).toEqual({
      name: "test",
      hoge: "aa",
    });
    expect(
      await rpcHelper.api.query.$match(url, {
        params: emptySchema,
        query: schema.strict(),
      }),
    ).toBeNull();
  });

  it("awaits async schemas and infers their outputs", async () => {
    const params: StandardSchemaV1<unknown, { foo: number }> = {
      "~standard": {
        version: 1,
        vendor: "test",
        validate: async (input) => {
          const result = z.object({ foo: z.string().regex(/^\d+$/) }).safeParse(input);

          return result.success
            ? { value: { foo: Number(result.data.foo) } }
            : { issues: [{ message: "Invalid foo" }] };
        },
      },
    };
    const schemas = {
      params,
      query: z.object({ page: z.string().default("1") }).transform(async ({ page }) => ({
        page: Number(page),
      })),
    };
    const match = await rpcHelper.fuga._foo.$match("/fuga/42", schemas);
    expect(match?.params).toEqual({ foo: 42 });
    expect(match?.query).toEqual({ page: 1 });
    expectTypeOf(match?.params).toEqualTypeOf<{ foo: number } | undefined>();
    expectTypeOf(match?.query).toEqualTypeOf<{ page: number } | undefined>();
    expect(await rpcHelper.fuga._foo.$match("/fuga/no", schemas)).toBeNull();
    expect(
      await rpcHelper.fuga._foo.$match("/fuga/42", {
        ...schemas,
        query: z.object({ page: z.string() }).refine(async () => false),
      }),
    ).toBeNull();
  });

  it("does not validate unmatched paths and stops after invalid params", async () => {
    const validate = vi.fn<(input: unknown) => { issues: { message: string }[] }>(() => ({
      issues: [{ message: "Invalid params" }],
    }));
    const queryValidate = vi.fn<(input: unknown) => { value: Record<string, never> }>(() => ({
      value: {},
    }));
    const schemas = {
      params: { "~standard": { version: 1 as const, vendor: "test", validate } },
      query: { "~standard": { version: 1 as const, vendor: "test", validate: queryValidate } },
    };
    expect(await rpcHelper.fuga._foo.$match("/other/test", schemas)).toBeNull();
    expect(validate).not.toHaveBeenCalled();
    expect(queryValidate).not.toHaveBeenCalled();
    expect(await rpcHelper.fuga._foo.$match("/fuga/test", schemas)).toBeNull();
    expect(validate).toHaveBeenCalledExactlyOnceWith({ foo: "test" });
    expect(queryValidate).not.toHaveBeenCalled();
  });

  it.each([false, true])("propagates schema exceptions (async: %s)", async (async) => {
    const failure = new Error("Schema failure");
    const query: StandardSchemaV1 = {
      "~standard": {
        version: 1,
        vendor: "test",
        validate: () => {
          if (async) return Promise.reject(failure);
          throw failure;
        },
      },
    };
    const schemas = {
      params: emptySchema,
      query,
    };
    await expect(rpcHelper.api.query.$match("/api/query", schemas)).rejects.toBe(failure);
  });

  it("accepts other Standard Schema implementations", async () => {
    const match = await rpcHelper.fuga._foo.$match("/fuga/value?mode=draft", {
      params: v.object({ foo: v.string() }),
      query: v.object({ mode: v.picklist(["draft", "published"]) }),
    });
    expect(match?.query).toEqual({ mode: "draft" });
    expectTypeOf(match?.query).toEqualTypeOf<{ mode: "draft" | "published" } | undefined>();
  });

  it.each([
    { key: "_%5F%5Fproto__", name: "__proto__", path: "/a%2Fb", value: "a/b" },
    { key: "___%5F%5Fproto__", name: "__proto__", path: "/a%2Fb/c", value: ["a/b", "c"] },
    { key: "_____%5F%5Fproto__", name: "__proto__", path: "/a%2Fb/c", value: ["a/b", "c"] },
    { key: "_____%5F%5Fproto__", name: "__proto__", path: "/", value: undefined },
    { key: "_constructor", name: "constructor", path: "/a%2Fb", value: "a/b" },
    { key: "_toString", name: "toString", path: "/a%2Fb", value: "a/b" },
  ])(
    "passes prototype-like params to validation as own properties ($key $path)",
    async ({ key, name, path, value }) => {
      const helper = createRpcHelper<RpcGeneratedPathStructure<Record<string, RpcEndpoint>>>();
      const params: StandardSchemaV1<unknown, Record<string, string | string[] | undefined>> = {
        "~standard": {
          version: 1,
          vendor: "test",
          validate: (input) => {
            if (typeof input !== "object" || input === null || !Object.hasOwn(input, name)) {
              return { issues: [{ message: "Missing own param" }] };
            }
            const result = z
              .union([z.string(), z.array(z.string()), z.undefined()])
              .safeParse(Object.getOwnPropertyDescriptor(input, name)?.value);

            return result.success
              ? { value: Object.assign(Object.create(null), { [name]: result.data }) }
              : { issues: [{ message: "Invalid param" }] };
          },
        },
      };
      const match = await helper[key].$match(`${path}?tag=a%2Fb&tag=c#hello%20world`, {
        params,
        query: z.object({ tag: z.array(z.string()) }),
      });
      expect(match).not.toBeNull();
      if (!match) throw new Error("Expected match");
      expect(Object.hasOwn(match.params, name)).toBe(true);
      expect(match.params[name]).toEqual(value);
      expect(Object.getPrototypeOf(match.params)).toBeNull();
      expect(match).toMatchObject({ query: { tag: ["a/b", "c"] }, hash: "hello world" });
    },
  );

  it.each([
    undefined,
    {},
    { params: emptySchema },
    { query: emptySchema },
    {
      params: emptySchema,
      query: { "~standard": { validate: "invalid" } },
    },
  ])("requires both runtime contracts even for untyped callers (%j)", async (schemas) => {
    await expect(
      Reflect.apply(rpcHelper.api.query.$match, undefined, ["/api/query", schemas]),
    ).rejects.toThrow("$match requires Standard Schema contracts for both params and query.");
  });

  it("requires contracts in the public types", () => {
    const checkTypes = () => {
      // @ts-expect-error generated path structures are required
      createRpcHelper<RpcEndpoint>();
      // @ts-expect-error both runtime schemas are required
      void rpcHelper.api.query.$match("/api/query");
      // @ts-expect-error query schema is required
      void rpcHelper.api.query.$match("/api/query", { params: emptySchema });
      // @ts-expect-error params schema is required
      void rpcHelper.api.query.$match("/api/query", { query: schema });
      // @ts-expect-error type-only query objects are not schemas
      void rpcHelper.api.query.$match("/api/query", { params: emptySchema, query: {} });
    };
    expectTypeOf(checkTypes).returns.toBeVoid();
  });
});
