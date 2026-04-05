import { procedure } from "rpc4next/server";
import { z } from "zod";
import { onError } from "../_shared/on-error";
import { routeContract } from "./route-contract";

export const GET = procedure
  .forRoute(routeContract)
  .query(
    z.object({
      name: z.string().min(1),
    }),
  )
  .handle(async ({ query, response }) =>
    response.text(`procedure-response-text:${query.name}`),
  )
  .nextRoute({
    method: "GET",
    onError,
  });
