import { nextRoute, rpcError } from "rpc4next/server";
import { z } from "zod";
import { guardedBaseProcedure } from "../../_shared/base-procedure";

const paramsSchema = z.object({
  userId: z.string().min(1),
});

const querySchema = z.object({
  includeDrafts: z.enum(["true", "false"]).optional(),
});

const getGuardedProcedureUser = guardedBaseProcedure
  .params(paramsSchema)
  .query(querySchema)
  .output({
    _output: {
      ok: true as const,
      userId: "" as string,
      includeDrafts: false as boolean,
      role: "reader" as "reader" | "editor",
      source: "procedure-guarded" as const,
      requestId: "" as string,
    },
  })
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

export const GET = nextRoute(getGuardedProcedureUser, { method: "GET" });

export type Query = z.input<typeof querySchema>;
