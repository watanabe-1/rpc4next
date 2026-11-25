import { z } from "zod";

import { appRouteProcedure } from "../../_rpc/route-procedure";
import { routeContract } from "./route-contract";

const outputSchema = z.object({
  ok: z.literal(true),
  source: z.literal("procedure-invalid-output"),
  result: z.string().min(1),
});

export const { GET } = appRouteProcedure
  .forRoute(routeContract)
  .meta({
    summary: "Phase 7 fixture that demonstrates runtime-enforced output validation failures",
    tags: ["procedure-examples", "runtime-output-enforcement"],
  })
  .output(outputSchema)
  .handle(async () => ({
    status: 200,
    body: {
      ok: true as const,
      source: "procedure-invalid-output" as const,
      result: 123,
    } as unknown as z.output<typeof outputSchema>,
  }))
  .get();
