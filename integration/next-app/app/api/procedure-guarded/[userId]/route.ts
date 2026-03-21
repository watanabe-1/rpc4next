import { nextRoute, rpcError } from "rpc4next/server";
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
  .error<"FORBIDDEN", { reason: "editor_only" }>("FORBIDDEN")
  .handle(async ({ params, query, ctx }) => {
    const role = ctx.viewer.role;
    const includeDrafts = query.includeDrafts === "true";

    if (includeDrafts && role !== "editor") {
      throw rpcError("FORBIDDEN", {
        message: "Editor role required to include drafts.",
        details: { reason: "editor_only" },
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

export const GET = nextRoute(getGuardedProcedureUser, {
  method: "GET",
  validateOutput: true,
});

export type Query = z.input<typeof querySchema>;
