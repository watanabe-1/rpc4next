import { describe, expectTypeOf, it } from "vitest";
import { z } from "zod";
import type { InferSchemaInput, InferSchemaOutput } from "./schema-inference";

describe("schema inference zod integration", () => {
  it("infers input types from zod metadata", () => {
    const schema = z.object({
      page: z.coerce.number().int().positive(),
    });

    type Input = InferSchemaInput<typeof schema>;

    expectTypeOf<Input>().toEqualTypeOf<{ page: unknown }>();
  });

  it("infers output types from zod metadata", () => {
    const schema = z.object({
      page: z.coerce.number().int().positive(),
    });

    type Output = InferSchemaOutput<typeof schema>;

    expectTypeOf<Output>().toEqualTypeOf<{ page: number }>();
  });
});
