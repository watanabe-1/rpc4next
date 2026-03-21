import { procedure, rpcError } from "rpc4next/server";
import { z } from "zod";

export const guardedProcedureHeadersSchema = z.object({
  "x-demo-user": z.string().min(1).optional(),
  "x-demo-role": z.enum(["reader", "editor", "suspended"]).optional(),
});

export const guardedBaseProcedure = procedure
  .headers(guardedProcedureHeadersSchema)
  .error<"UNAUTHORIZED", { reason: "missing_demo_user" }>("UNAUTHORIZED")
  .error<"FORBIDDEN", { reason: "suspended_account" }>("FORBIDDEN")
  .meta({
    summary:
      "Shared guardedProcedure preset with auth/policy error contracts for the integration fixture",
    tags: ["procedure-examples", "shared-base-procedure", "shared-errors"],
    auth: "required",
    idempotent: true,
  })
  .use(async ({ headers }) => {
    const viewerId = headers["x-demo-user"];

    if (!viewerId) {
      throw rpcError("UNAUTHORIZED", {
        message: "Demo user header required.",
        details: { reason: "missing_demo_user" },
      });
    }

    const role = headers["x-demo-role"] ?? "reader";

    if (role === "suspended") {
      throw rpcError("FORBIDDEN", {
        message: "Suspended demo users cannot access guarded procedures.",
        details: { reason: "suspended_account" },
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
  });
