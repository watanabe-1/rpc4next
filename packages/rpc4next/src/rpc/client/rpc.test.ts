import { describe, it, expect } from "vitest";
import { makeCreateRpc } from "./rpc";
import type { RpcHandler } from "./types";

// Minimal recursive chain type for arbitrary property access + callability
type Chain = {
  (arg?: unknown): Chain;
  [k: string]: Chain;
};

type Ctx = {
  paths: string[];
  params: Record<string, unknown>;
  dynamicKeys: string[];
};

type ChainWithCtx = Chain & {
  __ctx: Ctx;
  __value: Ctx; // short-circuit terminal value (no .call() collision)
};

describe("apply trap fallback messages (nullish coalescing branches)", () => {
  const passthroughHandler: RpcHandler = () => undefined;
  const create = makeCreateRpc(passthroughHandler);

  it('uses empty-string fallback when lastPath is "", exercising `${lastPath ?? ""}`', () => {
    const clientWithEmptyBase = create("", {}); // lastPath === "" (falsy & non-dynamic)
    expect(() => {
      (clientWithEmptyBase as unknown as (v: string) => void)("x");
    }).toThrow('Cannot apply a value: "" is not a dynamic segment.');
  });

  it("uses lastPath fallback when lastKey is undefined: `lastKey ?? lastPath`", () => {
    // Start from a *dynamic* base so `lastPath` is dynamic but `dynamicKeys` is still empty.
    const dynamicBase = create("_id", {});
    expect(() => {
      (dynamicBase as unknown as (v?: string) => void)();
    }).toThrow("Missing value for dynamic parameter: _id");
  });
});

describe("get trap behavior (symbols / thenable safety)", () => {
  const create = makeCreateRpc((_k, _c) => undefined);

  it("does not expose then (avoids accidental thenable behavior)", () => {
    const api = create("/", {});
    const thenVal = (api as unknown as { then?: unknown }).then;
    expect(thenVal).toBeUndefined();
  });

  it("returns undefined for symbol keys", () => {
    const api = create("/", {});
    // Use Reflect.get to avoid symbol indexing w/ implicit any
    const val = Reflect.get(api, Symbol.toStringTag) as unknown;
    expect(val).toBeUndefined();
  });
});

describe("chaining, dynamic params, and handler short-circuit", () => {
  const handler: RpcHandler = (key, ctx) => {
    if (key === "__ctx") {
      return {
        paths: ctx.paths,
        params: ctx.params,
        dynamicKeys: ctx.dynamicKeys,
      };
    }
    if (key === "__value") {
      // Snapshot to prove short-circuit returns a terminal value
      const snapshot: Ctx = {
        paths: [...ctx.paths],
        params: { ...ctx.params },
        dynamicKeys: [...ctx.dynamicKeys],
      };

      return snapshot;
    }

    return undefined;
  };
  const create = makeCreateRpc(handler);

  it("uses default base and options when omitted", () => {
    const api = create<ChainWithCtx>();
    const ctx = api.__ctx;

    expect(ctx.paths).toEqual(["/"]);
    expect(ctx.dynamicKeys).toEqual([]);
    expect(ctx.params).toEqual({});
  });

  it("accumulates paths and dynamic params; keeps placeholders in paths", () => {
    const api = create<ChainWithCtx>("/", {});
    const ctx = api.users._id(123).__ctx;

    expect(ctx.paths).toEqual(["/", "users", "_id"]);
    expect(ctx.dynamicKeys).toEqual(["_id"]);
    expect(ctx.params).toEqual({ _id: 123 });
  });

  it("supports multiple dynamic segments and preserves all dynamicKeys", () => {
    const api = create<ChainWithCtx>("/", {});
    const ctx = api.users._id(123).posts._postId("a").__ctx;

    expect(ctx.paths).toEqual(["/", "users", "_id", "posts", "_postId"]);
    expect(ctx.dynamicKeys).toEqual(["_id", "_postId"]);
    expect(ctx.params).toEqual({ _id: 123, _postId: "a" });
  });

  it("lets the handler short-circuit and return a terminal value", () => {
    const api = create<ChainWithCtx>("/", {});
    const result = api.users._id(42).__value;

    expect(result.paths).toEqual(["/", "users", "_id"]);
    expect(result.params).toEqual({ _id: 42 });
    expect(result.dynamicKeys).toEqual(["_id"]);
  });

  it('throws if applying a value when tail is not dynamic ("/")', () => {
    const api = create("/", {});
    expect(() => {
      (api as unknown as (v: string) => void)("x");
    }).toThrow('Cannot apply a value: "/" is not a dynamic segment.');
  });

  describe("coverage: RHS of `${lastPath ?? ''}` when lastPath becomes undefined", () => {
    // Expose a mutator via handler that empties the *same* paths array the proxy closes over.
    const handler: RpcHandler = (key, ctx) => {
      if (key === "__mutatePathsToEmpty") {
        return () => {
          // Make lastPath === undefined -> triggers `${lastPath ?? ""}` fallback
          (ctx.paths as unknown as string[]).length = 0;
        };
      }

      return undefined;
    };

    const create = makeCreateRpc(handler);

    // Extend the chain type with our mutator (no `any`).
    type ChainWithMutator = Chain & {
      __mutatePathsToEmpty: () => void;
    };

    it("falls back to empty string when lastPath is undefined", () => {
      const api = create<ChainWithMutator>("/", {});
      // Mutate internal state so paths becomes [], hence lastPath === undefined
      api.__mutatePathsToEmpty();

      expect(() => {
        (api as unknown as (v: string) => void)("x");
      }).toThrow('Cannot apply a value: "" is not a dynamic segment.');
    });
  });
});
