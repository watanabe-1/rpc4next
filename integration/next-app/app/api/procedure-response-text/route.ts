import { z } from "zod";

import { appProcedure } from "../_shared/procedure-defaults";
import { routeContract } from "./route-contract";

export const { GET } = appProcedure
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
