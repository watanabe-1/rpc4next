import { type as arktype } from "arktype";
import { describe, expectTypeOf, it } from "vitest";
import type { InferSchemaInput, InferSchemaOutput } from "./schema-inference";

describe("schema inference arktype integration", () => {
  it("infers input types from arktype metadata", () => {
    const schema = arktype({
      page: "string",
    });

    type Input = InferSchemaInput<typeof schema>;

    expectTypeOf<Input>().toEqualTypeOf<{ page: string }>();
  });

  it("infers output types from arktype metadata", () => {
    const schema = arktype({
      ok: "boolean",
    });

    type Output = InferSchemaOutput<typeof schema>;

    expectTypeOf<Output>().toEqualTypeOf<{ ok: boolean }>();
  });
});
