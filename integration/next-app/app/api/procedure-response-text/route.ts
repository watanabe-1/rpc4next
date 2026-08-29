import { z } from "zod";

import { appRouteProcedure } from "../../_rpc/route-procedure";
import { routeContract } from "./route-contract";

export const { GET } = appRouteProcedure
  .forRoute(routeContract)
  .query(
    z.object({
      name: z.string().min(1),
    }),
  )
  .handle(async ({ query, response }) => response.text(`procedure-response-text:${query.name}`))
  .nextRoute({
    method: "GET",
  });
