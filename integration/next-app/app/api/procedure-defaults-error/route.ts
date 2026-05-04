import { rpcError } from "rpc4next/server";
import { z } from "zod";

import { appProcedure } from "../_shared/procedure-defaults";
import { routeContract } from "./route-contract";

export const GET = appProcedure
  .forRoute(routeContract)
  .query(
    z.object({
      mode: z.enum(["deny"]).optional(),
    }),
  )
  .handle(async ({ query }) => {
    if (query.mode === "deny") {
      throw rpcError("FORBIDDEN", {
        message: "Procedure defaults formatter denied the request.",
        details: { reason: "defaults_formatter" },
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
