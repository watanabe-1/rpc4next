import { describe, expect, expectTypeOf, it } from "vitest";
import { z } from "zod";

import type { ParamsKey, RpcEndpoint, RpcGeneratedPathStructure } from "./generated";
import { createRpcClient } from "./index";
import { createRpcHelper } from "./rpc-helper";

type PathStructure = RpcGeneratedPathStructure<{
  日本語: {
    users: { __id: RpcEndpoint & Record<ParamsKey, { _id: string }> };
    files: { ____slug: RpcEndpoint & Record<ParamsKey, { _slug: string[] }> };
    optional: {
      ______slug: RpcEndpoint & Record<ParamsKey, { _slug: string[] | undefined }>;
    };
    "%5Fescaped": RpcEndpoint;
  };
}>;

const rpc = createRpcClient<PathStructure>("https://example.com");
const helper = createRpcHelper<PathStructure>();
const query = z.object({});
const schemas = {
  users: { params: z.object({ _id: z.string() }), query },
  files: { params: z.object({ _slug: z.array(z.string()) }), query },
  optional: {
    params: z
      .object({ _slug: z.array(z.string()).optional() })
      .transform(({ _slug }) => ({ _slug })),
    query,
  },
  static: { params: z.object({}), query },
};

describe("public URL and matching helpers", () => {
  it("round-trips a dynamic parameter with a leading underscore", async () => {
    const url = rpc.日本語.users.__id("a/b 日本語").$url({ hash: "見出し" });
    const match = await helper.日本語.users.__id.$match(url.path, schemas.users);

    expect(url.params).toEqual({ _id: "a/b 日本語" });
    expect(match).toEqual({ params: url.params, query: {}, hash: "見出し" });
    expect(await helper.日本語.users.__id.$match(url.relativePath, schemas.users)).toEqual(match);
    expectTypeOf(url.params).toEqualTypeOf<{ _id: string }>();
    expectTypeOf<NonNullable<typeof match>["params"]>().toEqualTypeOf<{ _id: string }>();
  });

  it("round-trips a catch-all parameter with a leading underscore", async () => {
    const url = rpc.日本語.files.____slug(["a/b", "日本語", "%2F"]).$url();
    const match = await helper.日本語.files.____slug.$match(url.path, schemas.files);

    expect(url.params).toEqual({ _slug: ["a/b", "日本語", "%2F"] });
    expect(match?.params).toEqual(url.params);
    expectTypeOf(url.params).toEqualTypeOf<{ _slug: string[] }>();
    expectTypeOf<NonNullable<typeof match>["params"]>().toEqualTypeOf<{ _slug: string[] }>();
  });

  it.each([{ value: ["a/b", "日本語"] }, { value: undefined }])(
    "round-trips an optional catch-all parameter ($value)",
    async ({ value }) => {
      const url = rpc.日本語.optional.______slug(value).$url();
      const match = await helper.日本語.optional.______slug.$match(
        url.relativePath,
        schemas.optional,
      );

      expect(url.params).toEqual({ _slug: value });
      expect(match?.params).toEqual(url.params);
      expectTypeOf(url.params).toEqualTypeOf<{ _slug: string[] | undefined }>();
      expectTypeOf<NonNullable<typeof match>["params"]>().toEqualTypeOf<{
        _slug: string[] | undefined;
      }>();
    },
  );

  it("round-trips Japanese and escaped static segments", async () => {
    const url = rpc.日本語["%5Fescaped"].$url();

    expect(url.relativePath).toBe("/%E6%97%A5%E6%9C%AC%E8%AA%9E/_escaped");
    expect(url.pathname).toBe("/日本語/_escaped");
    expect((await helper.日本語["%5Fescaped"].$match(url.path, schemas.static))?.params).toEqual(
      {},
    );
    expect(
      (await helper.日本語["%5Fescaped"].$match(new URL(url.path).pathname, schemas.static))
        ?.params,
    ).toEqual({});
  });
});
