import { build } from "esbuild";
import path from "node:path";
import { createRpcHelper } from "rpc4next/client/helper";
import { describe, expect, expectTypeOf, it } from "vitest";
import { z } from "zod";

import { paramsSchema, querySchema } from "../app/api/users/[userId]/schemas";
import { searchQuerySchema } from "../app/patterns/search/schemas";
import type { PathStructure } from "./generated/rpc";

const helper = createRpcHelper<PathStructure>();
const userSchemas = { params: paramsSchema, query: querySchema };

describe("generated helper validation with shared application schemas", () => {
  it("validates handler query values with the procedure's schema", async () => {
    const match = await helper.api.users._userId.$match(
      "/api/users/42?includePosts=true",
      userSchemas,
    );
    expect(match).toEqual({
      params: { userId: "42" },
      query: { includePosts: "true" },
      hash: undefined,
    });
    expectTypeOf(match?.params).toEqualTypeOf<{ userId: string } | undefined>();
    expectTypeOf(match?.query).toEqualTypeOf<
      | {
          includePosts?: "true" | "false" | undefined;
        }
      | undefined
    >();
    expect(
      await helper.api.users._userId.$match("/api/users/42?includePosts=invalid", userSchemas),
    ).toBeNull();
    expect(
      await helper.api.users._userId.$match(
        "/api/users/42?includePosts=true&includePosts=false",
        userSchemas,
      ),
    ).toBeNull();
  });

  it("returns the shared page schema's transformed query output", async () => {
    const schemas = { params: z.object({}), query: searchQuerySchema };
    const match = await helper.patterns.search.$match("/patterns/search?q=first&q=second", schemas);
    expect(match?.query).toEqual({ q: "first" });
    expectTypeOf(match?.query).toEqualTypeOf<{ q: string | undefined } | undefined>();
    expect((await helper.patterns.search.$match("/patterns/search", schemas))?.query).toEqual({
      q: undefined,
    });
  });

  it("validates native page queries instead of trusting their type-only declaration", async () => {
    const schemas = {
      params: z.object({}),
      query: z.object({
        term: z.union([z.string(), z.array(z.string())]).optional(),
        page: z.string().optional(),
      }),
    };
    const match = await helper.patterns["native-query"].$match(
      "/patterns/native-query?term=a&term=b&page=2",
      schemas,
    );
    expect(match?.query).toEqual({ term: ["a", "b"], page: "2" });
    expect(
      await helper.patterns["native-query"].$match("/patterns/native-query?page=1&page=2", schemas),
    ).toBeNull();
  });

  it("bundles the validated helper and shared schemas for browsers without server modules", async () => {
    const workspaceRoot = path.resolve(import.meta.dirname, "../../..");
    const result = await build({
      absWorkingDir: workspaceRoot,
      stdin: {
        contents: [
          'import { createRpcHelper } from "./packages/rpc4next/src/rpc/client/rpc-helper";',
          'import { paramsSchema, querySchema } from "./integration/next-app/app/api/users/[userId]/schemas";',
          "export const match = (url) => createRpcHelper().api.users._userId.$match(url, { params: paramsSchema, query: querySchema });",
        ].join("\n"),
        resolveDir: workspaceRoot,
        loader: "ts",
      },
      bundle: true,
      platform: "browser",
      format: "esm",
      write: false,
      metafile: true,
    });
    expect(result.outputFiles[0].text).toContain("Standard Schema contracts");
    expect(
      Object.keys(result.metafile.inputs).some((file) =>
        /(?:server-only|next-route|procedure\.ts|next\/dist)/.test(file),
      ),
    ).toBe(false);
  });
});
