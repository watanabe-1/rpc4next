import { z } from "zod";

import { appRouteProcedure } from "../../../_rpc/route-procedure";
import { routeContract } from "./route-contract";

const paramsSchema = z.object({
  userId: z.string().min(1),
});

const querySchema = z.object({
  includePosts: z.enum(["true", "false"]).optional(),
});

export const { GET } = appRouteProcedure
  .forRoute(routeContract)
  .meta({
    summary: "Procedure contract route",
    tags: ["procedure-contract"],
  })
  .params(paramsSchema)
  .query(querySchema)
  .use(async () => ({
    ctx: {
      requestId: "procedure-ctx",
    },
  }))
  .handle(async ({ params, query, ctx }) => ({
    status: 200,
    body: {
      ok: true as const,
      userId: params.userId,
      includePosts: query.includePosts === "true",
      source: "procedure-contract" as const,
      requestId: ctx.requestId,
    },
  }))
  .get();
