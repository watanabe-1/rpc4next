import { z } from "zod";

import { appProcedure } from "./procedure-defaults";

export const guardedProcedureHeadersSchema = z.object({
  "x-demo-user": z.string().min(1).optional(),
  "x-demo-role": z.enum(["reader", "editor", "suspended"]).optional(),
});

export const guardedBaseProcedure = appProcedure
  .headers(guardedProcedureHeadersSchema)
  .meta({
    summary:
      "Shared guardedProcedure preset with descriptive annotations for the integration fixture",
    tags: ["procedure-examples", "shared-base-procedure", "shared-errors"],
  })
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
  });
