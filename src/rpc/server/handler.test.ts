import { describe, it, expect, expectTypeOf } from "vitest";
import { createHandler } from "./handler";
import type { Handler, ValidationSchema } from "./route-types";
import type { Params, Query, RouteContext, TypedNextResponse } from "./types";
import type { HttpMethod } from "../lib/types";

describe("createHandler", () => {
  it("should return the same handler function", () => {
    const handler = async (c: RouteContext) => {
      return c.text("test");
    };
    const result = createHandler<HttpMethod, Params, Query, ValidationSchema>()(
      handler
    );

    expect(result).toBe(handler);
  });
});

describe("createHandler type definitions", () => {
  it("should infer types correctly", async () => {
    const _handler = createHandler<
      HttpMethod,
      Params,
      Query,
      ValidationSchema
    >()(async (c) => {
      return c.text("test");
    });

    type ExpectedHandlerType = Handler<
      HttpMethod,
      Params,
      Query,
      ValidationSchema,
      Promise<TypedNextResponse<"test", 200, "text/plain">>
    >;

    expectTypeOf<typeof _handler>().toEqualTypeOf<ExpectedHandlerType>();
  });
});
