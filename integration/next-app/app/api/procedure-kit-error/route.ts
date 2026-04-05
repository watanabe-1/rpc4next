import { z } from "zod";
import { procedureKit, rpcError } from "../_shared/procedure-kit";
import { routeContract } from "./route-contract";

const getProcedureKitError = procedureKit.procedure
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
  });

export const GET = procedureKit.nextRoute(getProcedureKitError, {
  method: "GET",
});
