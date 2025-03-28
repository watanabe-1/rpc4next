import { describe, expect, it } from "vitest";
import { createRpcHelper } from "./rpc";
import { Endpoint } from "./types";

export type PathStructure = Endpoint & {
  fuga: Endpoint & {
    _foo: Endpoint;
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
