import { z } from "zod";

import { appRouteProcedure } from "../../_rpc/route-procedure";
import { routeContract } from "./route-contract";

const explicitOutputSchema = z.object({
  ok: z.literal(true),
  source: z.literal("explicit-output"),
});

export const { GET } = appRouteProcedure
  .forRoute(routeContract)
  .output(explicitOutputSchema)
  .handle(({ response }) => response.json({ ok: true as const, source: "explicit-output" }))
  .get();
