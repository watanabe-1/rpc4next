import { z } from "zod";

import { appRouteProcedure } from "../../../_rpc/route-procedure";
import { routeContract } from "./route-contract";

const querySchema = z.object({
  includePosts: z.enum(["true", "false"]).optional(),
});

const paramsSchema = z.object({
  userId: z.string().min(1),
});

export const { GET } = appRouteProcedure
  .forRoute(routeContract)
  .params(paramsSchema)
  .query(querySchema)
  .output<{
    ok: true;
    userId: string;
    includePosts: boolean;
  }>()
  .handle(async ({ params, query }) => ({
    body: {
      ok: true,
      userId: params.userId,
      includePosts: query.includePosts === "true",
    },
  }))
  .nextRoute({ method: "GET" });
