import { procedure } from "rpc4next/server";
import { z } from "zod";

import { onError } from "../_shared/on-error";
import { routeContract } from "./route-contract";

const outputSchema = z.object({
  ok: z.literal(true),
  source: z.literal("procedure-invalid-output"),
  result: z.string().min(1),
});

export const GET = procedure
  .forRoute(routeContract)
  .meta({
    summary: "Phase 7 fixture that demonstrates runtime-enforced output validation failures",
    tags: ["procedure-examples", "runtime-output-enforcement"],
  })
  .output(outputSchema)
  .handle(async () => ({
    status: 200,
    body: {
      ok: true,
      source: "procedure-invalid-output",
      result: 123,
    } as unknown as z.output<typeof outputSchema>,
  }))
  .nextRoute({
    method: "GET",
    onError,
    validateOutput: true,
  });
