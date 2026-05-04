import * as v from "valibot";
import { describe, expectTypeOf, it } from "vitest";

import type { InferSchemaInput, InferSchemaOutput } from "./schema-inference";

describe("schema inference valibot integration", () => {
  it("infers input types from valibot metadata", () => {
    const schema = v.object({
      page: v.string(),
    });

    type Input = InferSchemaInput<typeof schema>;

    expectTypeOf<Input>().toEqualTypeOf<{ page: string }>();
  });

  it("infers output types from valibot metadata", () => {
    const schema = v.object({
      ok: v.boolean(),
    });

    type Output = InferSchemaOutput<typeof schema>;

    expectTypeOf<Output>().toEqualTypeOf<{ ok: boolean }>();
  });
});
