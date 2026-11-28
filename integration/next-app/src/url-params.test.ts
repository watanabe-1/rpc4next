import { createRpcClient } from "rpc4next/client";
import { createRpcHelper } from "rpc4next/client/helper";
import { describe, expect, expectTypeOf, it } from "vitest";
import { z } from "zod";

import type { PathStructure } from "./generated/rpc";

const client = createRpcClient<PathStructure>("http://127.0.0.1:3000");
const helper = createRpcHelper<PathStructure>();
const query = z.object({});
const pageSchemas = { params: z.object({ id: z.string() }), query };
const routeSchemas = { params: z.object({ userId: z.string() }), query };
const commentSchemas = { params: z.object({ id: z.string(), commentId: z.string() }), query };

describe("generated URL result params", () => {
  it.each([
    [42, "42"],
    [0, "0"],
    [-0, "0"],
    [-7, "-7"],
    [1.5, "1.5"],
    [1e21, "1e+21"],
    [NaN, "NaN"],
    [Infinity, "Infinity"],
    [-Infinity, "-Infinity"],
  ] as const)("returns string params for numeric input %s", async (value, expected) => {
    const pageUrl = client.users._id(value).$url();
    const routeUrl = client.api.users._userId(value).$url();

    expectTypeOf(client.users._id).parameter(0).toEqualTypeOf<string | number>();
    expectTypeOf(pageUrl.params).toEqualTypeOf<{ id: string }>();
    expectTypeOf(routeUrl.params).toEqualTypeOf<{ userId: string }>();
    expect(pageUrl.params.id).toBe(expected);
    expect(routeUrl.params.userId).toBe(expected);
    expect(pageUrl.params.id.toUpperCase()).toBe(expected.toUpperCase());
    expect(routeUrl.params.userId.toUpperCase()).toBe(expected.toUpperCase());
    expect(pageUrl.relativePath).toBe(`/users/${encodeURIComponent(expected)}`);
    expect(routeUrl.relativePath).toBe(`/api/users/${encodeURIComponent(expected)}`);
    expect((await helper.users._id.$match(pageUrl.path, pageSchemas))?.params).toEqual(
      pageUrl.params,
    );
    expect((await helper.users._id.$match(pageUrl.relativePath, pageSchemas))?.params).toEqual(
      pageUrl.params,
    );
    expect(
      (await helper.api.users._userId.$match(routeUrl.relativePath, routeSchemas))?.params,
    ).toEqual(routeUrl.params);
  });

  it("normalizes every numeric param in nested routes", async () => {
    const url = client.photo._id(42).comments._commentId(0).$url();

    expectTypeOf(url.params).toEqualTypeOf<{ id: string; commentId: string }>();
    expect(url.params).toEqual({ id: "42", commentId: "0" });
    expect(url.relativePath).toBe("/photo/42/comments/0");
    expect(
      (await helper.photo._id.comments._commentId.$match(url.relativePath, commentSchemas))?.params,
    ).toEqual(url.params);
  });

  it.each(["0042", "a/b", "a b", "%2F"])(
    "preserves unencoded string param %s alongside a numeric param",
    async (value) => {
      const url = client.photo._id(42).comments._commentId(value).$url();

      expect(url.params).toEqual({ id: "42", commentId: value });
      expect(url.relativePath).toBe(`/photo/42/comments/${encodeURIComponent(value)}`);
      expect(
        (await helper.photo._id.comments._commentId.$match(url.relativePath, commentSchemas))
          ?.params,
      ).toEqual(url.params);
    },
  );
});
