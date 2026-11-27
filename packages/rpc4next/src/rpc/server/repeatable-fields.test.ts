import { type } from "arktype";
import * as v from "valibot";
import { describe, expect, expectTypeOf, it } from "vitest";
import { z } from "zod";

import { searchParamsToObject } from "../lib/search-params";

const zodValues = z
  .union([z.string(), z.array(z.string())])
  .transform((value) => (Array.isArray(value) ? value : [value]));
const zodSchema = z.object({ tag: zodValues.optional() });

const valibotValues = v.pipe(
  v.union([v.string(), v.array(v.string())]),
  v.transform((value) => (Array.isArray(value) ? value : [value])),
);
const valibotSchema = v.object({ tag: v.optional(valibotValues) });

const arkValues = type("string | string[]").pipe((value) =>
  Array.isArray(value) ? value : [value],
);
const arkSchema = type({ "tag?": arkValues });

describe("documented repeatable string schemas", () => {
  it("preserves input and output types", () => {
    expectTypeOf<z.input<typeof zodSchema>["tag"]>().toEqualTypeOf<string | string[] | undefined>();
    expectTypeOf<z.output<typeof zodSchema>["tag"]>().toEqualTypeOf<string[] | undefined>();
    expectTypeOf<v.InferInput<typeof valibotSchema>["tag"]>().toEqualTypeOf<
      string | string[] | undefined
    >();
    expectTypeOf<v.InferOutput<typeof valibotSchema>["tag"]>().toEqualTypeOf<
      string[] | undefined
    >();
    expectTypeOf<(typeof arkSchema.inferIn)["tag"]>().toEqualTypeOf<
      string | string[] | undefined
    >();
    expectTypeOf<(typeof arkSchema.infer)["tag"]>().toEqualTypeOf<string[] | undefined>();
  });

  it.each([
    ["", undefined],
    ["tag=a", ["a"]],
    ["tag=a&tag=b", ["a", "b"]],
  ])("parses query values %s", (query, expected) => {
    const input = searchParamsToObject(new URLSearchParams(query));
    expect(zodSchema.parse(input).tag).toEqual(expected);
    expect(v.parse(valibotSchema, input).tag).toEqual(expected);
    expect(arkSchema.assert(input).tag).toEqual(expected);
  });

  it("rejects invalid elements", () => {
    const input = { tag: ["a", 1] };
    expect(zodSchema.safeParse(input).success).toBe(false);
    expect(v.safeParse(valibotSchema, input).success).toBe(false);
    expect(() => arkSchema.assert(input)).toThrow();
  });
});
