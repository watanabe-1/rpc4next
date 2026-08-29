import { z } from "zod";

import { appRouteProcedure } from "../../_rpc/route-procedure";
import { routeContract } from "./route-contract";

export const { GET } = appRouteProcedure
  .forRoute(routeContract)
  .query(
    z.object({
      mode: z.enum(["deny"]).optional(),
    }),
  )
  .handle(async ({ query, response }) => {
    if (query.mode === "deny") {
      return response.error("FORBIDDEN", {
        message: "Procedure defaults formatter denied the request.",
        details: { reason: "defaults_formatter" as const },
      });
    }

    return {
      status: 200,
      body: {
        ok: true as const,
        source: "procedure-defaults-error" as const,
      },
    };
  })
  .nextRoute({
    method: "GET",
  });
