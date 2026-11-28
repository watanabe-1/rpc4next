import { appRouteProcedure } from "../../../_rpc/route-procedure";
import { routeContract } from "./route-contract";
import { paramsSchema, querySchema } from "./schemas";

export const { GET } = appRouteProcedure
  .forRoute(routeContract)
  .params(paramsSchema)
  .query(querySchema)
  .handle(async ({ params, query }) => ({
    body: {
      ok: true as const,
      userId: params.userId,
      includePosts: query.includePosts === "true",
    },
  }))
  .get();
