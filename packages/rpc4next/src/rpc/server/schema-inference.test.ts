import { describe, expectTypeOf, it } from "vitest";
import type {
  InferSchemaInput,
  InferSchemaOutput,
  OutputSchema,
} from "./schema-inference";
import type { StandardSchemaV1 } from "./standard-schema";

describe("schema inference", () => {
  it("prefers Standard Schema V1 types when available", () => {
    type Input = InferSchemaInput<
      StandardSchemaV1<{ page?: string }, { page: number }>
    >;
    type Output = InferSchemaOutput<
      StandardSchemaV1<{ page?: string }, { page: number }>
    >;

    expectTypeOf<Input>().toEqualTypeOf<{ page?: string }>();
    expectTypeOf<Output>().toEqualTypeOf<{ page: number }>();
  });

  it("falls back to _input metadata", () => {
    type Input = InferSchemaInput<{ _input?: { page?: string } }>;

    expectTypeOf<Input>().toEqualTypeOf<{ page?: string }>();
  });

  it("falls back to _output metadata", () => {
    type Output = InferSchemaOutput<{ _output?: { page: number } }>;

    expectTypeOf<Output>().toEqualTypeOf<{ page: number }>();
  });

  it("falls back to _type metadata", () => {
    type Output = InferSchemaOutput<{ _type: { ok: true } }>;

    expectTypeOf<Output>().toEqualTypeOf<{ ok: true }>();
  });

  it("falls back to input/output metadata", () => {
    type Input = InferSchemaInput<{ input: { page?: string } }>;
    type Output = InferSchemaOutput<{ output: { page: number } }>;

    expectTypeOf<Input>().toEqualTypeOf<{ page?: string }>();
    expectTypeOf<Output>().toEqualTypeOf<{ page: number }>();
  });

  it("defines OutputSchema without zod-specific metadata", () => {
    type Actual = OutputSchema<{ ok: true }>;
    type Expected =
      | StandardSchemaV1<unknown, { ok: true }>
      | { _output: { ok: true } }
      | { _type: { ok: true } }
      | { output: { ok: true } };

    expectTypeOf<Actual>().toEqualTypeOf<Expected>();
  });
});
