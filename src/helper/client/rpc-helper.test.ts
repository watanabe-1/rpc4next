import { describe, expect, expectTypeOf, it } from "vitest";
import { createRpcHelper } from "./rpc";
import { Endpoint, ParamsKey } from "./types";

type PathStructure = Endpoint & {
  fuga: Endpoint & {
    _foo: Endpoint & Record<ParamsKey, { foo: string }>;
  };
};

const rpcHelper = createRpcHelper<PathStructure>();

describe("createRpcHelper basic behavior", () => {
  it("Simple dynamic segment", () => {
    const match = rpcHelper.fuga._foo.$match("/fuga/test");
    expect(match).toEqual({ foo: "test" });
  });

  it("Returns null for unmatched paths", () => {
    const match = rpcHelper.fuga._foo.$match("/hoge/test");
    expect(match).toBeNull();
  });
});

describe("createRpcHelper type definitions", () => {
  it("should infer types correctly", async () => {
    const _dynamic = rpcHelper.fuga._foo.$match("/fuga/dynamic");

    type ExpectedDynamicMatch = {
      foo: string;
    } | null;

    expectTypeOf<typeof _dynamic>().toEqualTypeOf<ExpectedDynamicMatch>();
  });
});
