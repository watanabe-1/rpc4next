import { createRpcClient } from "rpc4next/client";
import { createRpcHelper } from "rpc4next/client/helper";
import { describe, expect, it, vi } from "vitest";
import { z } from "zod";

import type { PathStructure } from "./generated/rpc";

describe("reserved static route names", () => {
  it("uses generated page and handler keys for routes and their children", async () => {
    const fetch = vi.fn<typeof globalThis.fetch>(async () => Response.json({ ok: true }));
    const client = createRpcClient<PathStructure>("https://example.com", { fetch });
    const helper = createRpcHelper<PathStructure>();
    const schemas = { params: z.object({}), query: z.object({}) };
    const pages = client["reserved-routes"]["%24url"];
    const routes = client["reserved-routes"]["%24get"];

    expect(pages.$url().relativePath).toBe("/reserved-routes/%24url");
    expect(pages.child.$url().relativePath).toBe("/reserved-routes/%24url/child");
    expect(routes.$url().relativePath).toBe("/reserved-routes/%24get");
    expect(routes.child.$url().relativePath).toBe("/reserved-routes/%24get/child");
    expect(
      await helper["reserved-routes"]["%24url"].child.$match(
        "/reserved-routes/%24url/child",
        schemas,
      ),
    ).not.toBeNull();

    await routes.$get();
    await routes.child.$get();
    expect(fetch.mock.calls.map(([input]) => input)).toEqual([
      "https://example.com/reserved-routes/%24get",
      "https://example.com/reserved-routes/%24get/child",
    ]);
  });
});
