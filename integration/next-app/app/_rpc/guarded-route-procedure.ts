import { z } from "zod";

import { appRouteProcedure } from "./route-procedure";

export const guardedProcedureHeadersSchema = z.object({
  "x-demo-user": z.string().min(1).optional(),
  "x-demo-role": z.enum(["reader", "editor", "suspended"]).optional(),
  "x-demo-org": z.string().min(1).optional(),
  "x-demo-plan": z.enum(["free", "pro", "enterprise"]).optional(),
  "x-trace-id": z.string().min(1).optional(),
});

export const guardedRouteProcedure = appRouteProcedure
  .headers(guardedProcedureHeadersSchema)
  .meta({
    summary:
      "Shared guardedProcedure preset with descriptive annotations for the integration fixture",
    tags: ["procedure-examples", "shared-route-procedure", "shared-errors"],
  })
  // Adds request-level tracing before auth checks or protected data access.
  .use(({ headers, request }) => {
    const traceId =
      headers["x-trace-id"] ??
      `trace-${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 8)}`;

    console.info("[rpc4next] guarded procedure trace", {
      method: request.method,
      pathname: request.nextUrl.pathname,
      traceId,
    });

    return {
      ctx: {
        traceId,
      },
    };
  })
  // Verifies the demo viewer once for every route that starts from this preset.
  .use(async ({ headers, response }) => {
    const viewerId = headers["x-demo-user"];

    if (!viewerId) {
      return response.error("UNAUTHORIZED", {
        message: "Demo user header required.",
        details: { reason: "missing_demo_user" as const },
      });
    }

    const role = headers["x-demo-role"] ?? "reader";

    if (role === "suspended") {
      return response.error("FORBIDDEN", {
        message: "Suspended demo users cannot access guarded procedures.",
        details: { reason: "suspended_account" as const },
      });
    }

    return {
      ctx: {
        viewer: {
          id: viewerId,
          role,
        },
        requestId: `guarded:${viewerId}`,
      },
    };
  })
  // Resolves tenant context and blocks plans that cannot use guarded routes.
  .use(async ({ headers, response }) => {
    const plan = headers["x-demo-plan"] ?? "pro";

    if (plan === "free") {
      return response.error("FORBIDDEN", {
        message: "A paid demo plan is required for guarded procedures.",
        details: { reason: "plan_upgrade_required" as const },
      });
    }

    return {
      ctx: {
        organization: {
          id: headers["x-demo-org"] ?? "demo-org",
          plan,
        },
      },
    };
  });
