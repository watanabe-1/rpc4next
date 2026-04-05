import { z } from "zod";
import { appProcedure, rpcError } from "../_shared/procedure-kit";
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
        message: "Procedure kit formatter denied the request.",
        details: { reason: "kit_formatter" },
      });
    }

    return {
      status: 200,
      body: {
        ok: true as const,
        source: "procedure-kit-error" as const,
      },
    };
  })
  .nextRoute({
    method: "GET",
  });
