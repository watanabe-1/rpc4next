const routeSourceLeakSentinel = "rpc4next-client-bundle-route-source-leak-sentinel";

(globalThis as unknown as Record<string, string>).__rpc4nextClientBundleLeakSentinel =
  routeSourceLeakSentinel;

export const GET = () =>
  Response.json({
    ok: true,
  });
