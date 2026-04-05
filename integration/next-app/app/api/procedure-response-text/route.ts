import { nextRoute, procedure } from "rpc4next/server";
import { z } from "zod";
import { onError } from "../_shared/on-error";
import { routeContract } from "./route-contract";

const getProcedureResponseText = procedure
  .forRoute(routeContract)
  .query(
    z.object({
      name: z.string().min(1),
    }),
  )
  .handle(async ({ query, response }) =>
    response.text(`procedure-response-text:${query.name}`),
  );

export const GET = nextRoute(getProcedureResponseText, {
  method: "GET",
  onError,
});
