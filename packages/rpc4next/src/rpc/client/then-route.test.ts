import { describe, expect, expectTypeOf, it, vi } from "vitest";

import type { RpcEndpoint, RpcGeneratedPathStructure } from "./generated";
import { createRpcClient } from "./rpc-client";
import { createRpcHelper } from "./rpc-helper";
import { createRpcTestClient, createRpcTestPageClient } from "./test";

const get = async () => Response.json({ ok: true });
type Endpoint = RpcEndpoint & { $get: typeof get };
type Paths = RpcGeneratedPathStructure<{
  "%74hen": Endpoint;
  nested: { "%74hen": Endpoint };
  "%2574hen": Endpoint;
  _then: Endpoint;
}>;

describe("static then routes", () => {
  it("builds and matches root and nested URLs without confusing encoded keys", () => {
    const rpc = createRpcClient<Paths>("https://example.com");
    const helper = createRpcHelper<Paths>();
    expect(rpc["%74hen"].$url().relativePath).toBe("/then");
    expect(rpc.nested["%74hen"].$url().relativePath).toBe("/nested/then");
    expect(rpc["%2574hen"].$url().relativePath).toBe("/%2574hen");
    expect(helper["%74hen"].$match("/then")?.params).toEqual({});
    expect(helper.nested["%74hen"].$match("/nested/then")?.params).toEqual({});
    expect(helper["%74hen"].$match("/%2574hen")).toBeNull();
    expectTypeOf(rpc["%74hen"]).toEqualTypeOf(rpc.nested["%74hen"]);
    expectTypeOf<"then">().not.toExtend<keyof typeof rpc>();
  });

  it("dispatches HTTP calls and page renders through the escaped key", async () => {
    const pathnames = ["/then", "/nested/then"];
    const routes = createRpcTestClient<Paths>(
      pathnames.map((pathname) => ({
        pathname,
        methods: ["GET"],
        load: async () => ({ GET: async () => Response.json({ pathname }) }),
      })),
    );
    const pages = createRpcTestPageClient<Paths>(
      pathnames.map((pathname) => ({
        pathname,
        load: async () => ({ default: async () => pathname }),
      })),
    );
    expect(await (await routes["%74hen"].$get()).json()).toEqual({ pathname: "/then" });
    expect(await (await routes.nested["%74hen"].$get()).json()).toEqual({
      pathname: "/nested/then",
    });
    expect(await pages["%74hen"].$render()).toBe("/then");
    expect(await pages.nested["%74hen"].$render()).toBe("/nested/then");
  });

  it("resolves every proxy unchanged without dispatching calls", async () => {
    const fetch = vi.fn<typeof globalThis.fetch>();
    const rpc = createRpcClient<Paths>("https://example.com", { fetch });
    const helper = createRpcHelper<Paths>();
    const routes = createRpcTestClient<Paths>([]);
    const pages = createRpcTestPageClient<Paths>([]);
    for (const proxy of [
      rpc,
      rpc["%74hen"],
      rpc.nested["%74hen"],
      helper,
      helper["%74hen"],
      routes["%74hen"],
      pages["%74hen"],
    ]) {
      expect(await (proxy as unknown)).toBe(proxy);
      expect(await Promise.resolve(proxy)).toBe(proxy);
    }
    expect(fetch).not.toHaveBeenCalled();
  });
});
