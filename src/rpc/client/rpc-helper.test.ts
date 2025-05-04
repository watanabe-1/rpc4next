import { describe, expect, expectTypeOf, it } from "vitest";
import { z } from "zod";
import { createRpcHelper } from "./rpc-helper";
import { routeHandlerFactory } from "../server";
import { zValidator } from "../server/validators/zod";
import type { Endpoint, ParamsKey, QueryKey } from "./types";

const createRouteHandler = routeHandlerFactory();

const schema = z.object({
  name: z.string(),
  hoge: z.string(),
});

const { POST: _post_query } = createRouteHandler<{
  query: z.input<typeof schema>;
}>().post(zValidator("query", schema), (rc) => rc.text("text"));

type PathStructure = Endpoint & {
  fuga: Endpoint & {
    _foo: Endpoint &
      Record<ParamsKey, { foo: string }> & {
        _piyo: Endpoint &
          Record<QueryKey, { baz: string }> &
          Record<ParamsKey, { foo: string; piyo: string }>;
      };
  };
  api: {
    query: { $post: typeof _post_query } & Endpoint;
  };
};

const rpcHelper = createRpcHelper<PathStructure>();

describe("createRpcHelper basic behavior", () => {
  it("Simple dynamic segment", () => {
    const match = rpcHelper.fuga._foo.$match("/fuga/test");
    expect(match).toEqual({
      params: { foo: "test" },
      query: {},
      hash: undefined,
    });
  });

  it("Dynamic segment with query and hash", () => {
    const match = rpcHelper.fuga._foo._piyo.$match(
      "/fuga/foo/bar?baz=value#section"
    );
    expect(match).toEqual({
      params: { foo: "foo", piyo: "bar" },
      query: { baz: "value" },
      hash: "section",
    });
  });

  it("Query validation segment with query and hash", () => {
    const match = rpcHelper.api.query.$match(
      "/api/query?name=test&hoge=aa#hash123"
    );
    expect(match).toEqual({
      params: {},
      query: { name: "test", hoge: "aa" },
      hash: "hash123",
    });
  });

  it("Returns null for unmatched paths", () => {
    const match = rpcHelper.fuga._foo.$match("/hoge/test");
    expect(match).toBeNull();
  });
});

describe("createRpcHelper type definitions", () => {
  it("should infer params types correctly", async () => {
    const _dynamic = rpcHelper.fuga._foo.$match("/fuga/dynamic");

    type ExpectedDynamicMatch =
      | ({
          params: {
            foo: string;
          };
        } & {
          hash?: string;
        })
      | null;

    expectTypeOf<typeof _dynamic>().toEqualTypeOf<ExpectedDynamicMatch>();
  });

  it("should infer query types correctly", async () => {
    const _dynamic = rpcHelper.fuga._foo._piyo.$match(
      "/fuga/dynamic/query?baz=test"
    );

    type ExpectedDynamicMatch =
      | ({
          params: {
            foo: string;
            piyo: string;
          };
        } & {
          query?: {
            baz: string;
          };
          hash?: string;
        })
      | null;

    expectTypeOf<typeof _dynamic>().toEqualTypeOf<ExpectedDynamicMatch>();
  });

  it("should infer query validater types correctly", async () => {
    const _dynamic = rpcHelper.api.query.$match("/api/query?name=test&hoge=aa");

    type ExpectedDynamicMatch =
      | ({
          params: Record<string, string>;
        } & {
          query?: {
            name: string;
            hoge: string;
          };
          hash?: string;
        })
      | null;

    expectTypeOf<typeof _dynamic>().toEqualTypeOf<ExpectedDynamicMatch>();
  });
});
