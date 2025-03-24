import { describe, it, expect } from "vitest";
import { createHandler } from "./create-handler";
import {
  Handler,
  Params,
  Query,
  RouteContext,
  TypedNextResponse,
  ValidationSchema,
} from "./types";
import { Equal, Expect } from "../../__tests__/types";

describe("createHandler", () => {
  it("should return the same handler function", () => {
    const handler = async (c: RouteContext) => {
      return c.text("test");
    };
    const result = createHandler<Params, Query, ValidationSchema>()(handler);

    expect(result).toBe(handler);
  });
});

describe("createHandler type definitions", () => {
  // eslint-disable-next-line vitest/expect-expect
  it("should infer types correctly", async () => {
    const _handler = createHandler<Params, Query, ValidationSchema>()(async (
      c
    ) => {
      return c.text("test");
    });

    type ExpectedHandlerType = Handler<
      Params,
      Query,
      ValidationSchema,
      Promise<TypedNextResponse<"test", 200, "text/plain">>
    >;

    type _Result1 = Expect<Equal<ExpectedHandlerType, typeof _handler>>;
  });
});
