import { z } from "zod";

import { guardedBaseProcedure } from "../../_shared/base-procedure";
import { routeContract } from "./route-contract";

const paramsSchema = z.object({
  userId: z.string().min(1),
});

const querySchema = z.object({
  includeDrafts: z.enum(["true", "false"]).optional(),
});

const outputSchema = z.object({
  ok: z.literal(true),
  userId: z.string().min(1),
  includeDrafts: z.boolean(),
  role: z.enum(["reader", "editor"]),
  source: z.literal("procedure-guarded"),
  requestId: z.string().min(1),
});

const getGuardedProcedureUser = guardedBaseProcedure
  .forRoute(routeContract)
  .params(paramsSchema)
  .query(querySchema)
  .output(outputSchema)
  .handle(async ({ params, query, ctx, response }) => {
    const role = ctx.viewer.role;
    const includeDrafts = query.includeDrafts === "true";

    if (includeDrafts && role !== "editor") {
      return response.error("FORBIDDEN", {
        message: "Editor role required to include drafts.",
        details: { reason: "editor_only" as const },
      });
    }

    return {
      status: 200,
      body: {
        ok: true,
        userId: params.userId,
        includeDrafts,
        role,
        source: "procedure-guarded",
        requestId: ctx.requestId,
      },
    };
  });

export const { GET } = getGuardedProcedureUser.nextRoute({
  method: "GET",
  validateOutput: true,
});
