import { createRpcClient } from "rpc4next/client";
import { createRpcHelper } from "rpc4next/client/helper";
import { createRpcTestClient, createRpcTestPageClient } from "rpc4next/client/test";
import { describe, expect, expectTypeOf, it } from "vitest";
import { z } from "zod";

import type { PathStructure } from "./generated/rpc";
import { testRoutes } from "./generated/rpc-test-manifest";

const client = createRpcClient<PathStructure>("https://example.com")["param-names"];
const helper = createRpcHelper<PathStructure>()["param-names"];
const testClient = createRpcTestClient<PathStructure>(testRoutes)["param-names"];
// Reuse generated pathnames to exercise the page proxy's independent parameter types.
const pages = testRoutes.map(({ pathname }) => ({
  pathname,
  load: async () => ({
    default: async ({
      params,
    }: {
      params: Promise<Record<string, string | string[] | undefined>>;
    }) => params,
  }),
}));
const pageClient = createRpcTestPageClient<PathStructure>(pages)["param-names"];

describe("generated parameter names across clients", () => {
  it.each([
    {
      label: "plain",
      name: "id",
      segment: client.dynamic.plain["_id"],
      match: helper.dynamic.plain["_id"].$match,
      testSegment: testClient.dynamic.plain["_id"],
      pageSegment: pageClient.dynamic.plain["_id"],
    },
    {
      label: "one",
      name: "_id",
      segment: client.dynamic.one["_%5Fid"],
      match: helper.dynamic.one["_%5Fid"].$match,
      testSegment: testClient.dynamic.one["_%5Fid"],
      pageSegment: pageClient.dynamic.one["_%5Fid"],
    },
    {
      label: "two",
      name: "__id",
      segment: client.dynamic.two["_%5F%5Fid"],
      match: helper.dynamic.two["_%5F%5Fid"].$match,
      testSegment: testClient.dynamic.two["_%5F%5Fid"],
      pageSegment: pageClient.dynamic.two["_%5F%5Fid"],
    },
    {
      label: "four",
      name: "____id",
      segment: client.dynamic.four["_%5F%5F%5F%5Fid"],
      match: helper.dynamic.four["_%5F%5F%5F%5Fid"].$match,
      testSegment: testClient.dynamic.four["_%5F%5F%5F%5Fid"],
      pageSegment: pageClient.dynamic.four["_%5F%5F%5F%5Fid"],
    },
  ])(
    "preserves dynamic $name parameters",
    async ({ label, name, segment, match, testSegment, pageSegment }) => {
      const schemas = { params: z.object({ [name]: z.string() }), query: z.object({}) };
      expectTypeOf(segment).parameters.toEqualTypeOf<[value: string | number]>();
      expectTypeOf(pageSegment).parameters.toEqualTypeOf<[value: string | number]>();
      for (const value of ["a/b 日本語"]) {
        const url = segment(value).$url();
        expect(url.pathname).toBe(`/param-names/dynamic/${label}/[${name}]`);
        expect(url.relativePath).toBe(
          `/param-names/dynamic/${label}${"/a%2Fb%20%E6%97%A5%E6%9C%AC%E8%AA%9E"}`,
        );
        expect(url.params).toEqual({ [name]: value });
        expect((await match(url.path, schemas))?.params).toEqual(url.params);
        expect((await match(url.relativePath, schemas))?.params).toEqual(url.params);
        const response = await testSegment(value).$get();
        expect(response.status).toBe(200);
        await expect(response.json()).resolves.toEqual(value ? url.params : {});
        await expect(pageSegment(value).$render()).resolves.toEqual(url.params);
      }
      expect(await match(`/param-names/dynamic/${label}/a/b`, schemas)).toBeNull();
    },
  );

  it.each([
    {
      label: "plain",
      name: "id",
      segment: client.catch.plain["___id"],
      match: helper.catch.plain["___id"].$match,
      testSegment: testClient.catch.plain["___id"],
      pageSegment: pageClient.catch.plain["___id"],
    },
    {
      label: "one",
      name: "_id",
      segment: client.catch.one["___%5Fid"],
      match: helper.catch.one["___%5Fid"].$match,
      testSegment: testClient.catch.one["___%5Fid"],
      pageSegment: pageClient.catch.one["___%5Fid"],
    },
    {
      label: "two",
      name: "__id",
      segment: client.catch.two["___%5F%5Fid"],
      match: helper.catch.two["___%5F%5Fid"].$match,
      testSegment: testClient.catch.two["___%5F%5Fid"],
      pageSegment: pageClient.catch.two["___%5F%5Fid"],
    },
    {
      label: "four",
      name: "____id",
      segment: client.catch.four["___%5F%5F%5F%5Fid"],
      match: helper.catch.four["___%5F%5F%5F%5Fid"].$match,
      testSegment: testClient.catch.four["___%5F%5F%5F%5Fid"],
      pageSegment: pageClient.catch.four["___%5F%5F%5F%5Fid"],
    },
  ])(
    "preserves catch $name parameters",
    async ({ label, name, segment, match, testSegment, pageSegment }) => {
      const schemas = { params: z.object({ [name]: z.array(z.string()) }), query: z.object({}) };
      expectTypeOf(segment).parameters.toEqualTypeOf<[value: [string, ...string[]]]>();
      expectTypeOf(pageSegment).parameters.toEqualTypeOf<[value: [string, ...string[]]]>();
      for (const value of [["a/b", "c"] as [string, ...string[]]]) {
        const url = segment(value).$url();
        expect(url.pathname).toBe(`/param-names/catch/${label}/[...${name}]`);
        expect(url.relativePath).toBe(`/param-names/catch/${label}${value ? "/a%2Fb/c" : ""}`);
        expect(url.params).toEqual({ [name]: value });
        expect((await match(url.path, schemas))?.params).toEqual(url.params);
        expect((await match(url.relativePath, schemas))?.params).toEqual(url.params);
        const response = await testSegment(value).$get();
        expect(response.status).toBe(200);
        await expect(response.json()).resolves.toEqual(value ? url.params : {});
        await expect(pageSegment(value).$render()).resolves.toEqual(url.params);
      }
      expect(await match(`/param-names/catch/${label}`, schemas)).toBeNull();
    },
  );

  it.each([
    {
      label: "plain",
      name: "id",
      segment: client.optional.plain["_____id"],
      match: helper.optional.plain["_____id"].$match,
      testSegment: testClient.optional.plain["_____id"],
      pageSegment: pageClient.optional.plain["_____id"],
    },
    {
      label: "one",
      name: "_id",
      segment: client.optional.one["_____%5Fid"],
      match: helper.optional.one["_____%5Fid"].$match,
      testSegment: testClient.optional.one["_____%5Fid"],
      pageSegment: pageClient.optional.one["_____%5Fid"],
    },
    {
      label: "two",
      name: "__id",
      segment: client.optional.two["_____%5F%5Fid"],
      match: helper.optional.two["_____%5F%5Fid"].$match,
      testSegment: testClient.optional.two["_____%5F%5Fid"],
      pageSegment: pageClient.optional.two["_____%5F%5Fid"],
    },
    {
      label: "four",
      name: "____id",
      segment: client.optional.four["_____%5F%5F%5F%5Fid"],
      match: helper.optional.four["_____%5F%5F%5F%5Fid"].$match,
      testSegment: testClient.optional.four["_____%5F%5F%5F%5Fid"],
      pageSegment: pageClient.optional.four["_____%5F%5F%5F%5Fid"],
    },
  ])(
    "preserves optional $name parameters",
    async ({ label, name, segment, match, testSegment, pageSegment }) => {
      const schemas = {
        params: z.object({ [name]: z.array(z.string()).optional() }),
        query: z.object({}),
      };
      expectTypeOf(segment).parameters.toEqualTypeOf<[value?: string[]]>();
      expectTypeOf(pageSegment).parameters.toEqualTypeOf<[value?: string[]]>();
      for (const value of [["a/b", "c"], undefined]) {
        const url = segment(value).$url();
        expect(url.pathname).toBe(`/param-names/optional/${label}/[[...${name}]]`);
        expect(url.relativePath).toBe(`/param-names/optional/${label}${value ? "/a%2Fb/c" : ""}`);
        expect(url.params).toEqual({ [name]: value });
        expect((await match(url.path, schemas))?.params).toEqual(url.params);
        expect((await match(url.relativePath, schemas))?.params).toEqual(url.params);
        const response = await testSegment(value).$get();
        expect(response.status).toBe(200);
        await expect(response.json()).resolves.toEqual(value ? url.params : {});
        await expect(pageSegment(value).$render()).resolves.toEqual(url.params);
      }
      expect(segment().$url().params).toEqual({ [name]: undefined });
      await expect(pageSegment().$render()).resolves.toEqual({ [name]: undefined });
    },
  );

  it("retains original parameter names in generated URL and match types", async () => {
    const url = client.dynamic.two["_%5F%5Fid"]("value").$url();
    const match = await helper.dynamic.two["_%5F%5Fid"].$match(url.path, {
      params: z.object({ __id: z.string() }),
      query: z.object({}),
    });
    expectTypeOf(url.params).toEqualTypeOf<{ __id: string }>();
    expectTypeOf<NonNullable<typeof match>["params"]>().toEqualTypeOf<{ __id: string }>();
    expectTypeOf(client.catch.four["___%5F%5F%5F%5Fid"](["a"]).$url().params).toEqualTypeOf<{
      ____id: string[];
    }>();
    expectTypeOf(client.optional.two["_____%5F%5Fid"]().$url().params).toEqualTypeOf<{
      __id: string[] | undefined;
    }>();
  });
});
