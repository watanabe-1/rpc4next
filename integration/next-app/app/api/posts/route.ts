import { procedure } from "rpc4next/server";
import { z } from "zod";

import { onError } from "../_shared/on-error";
import { routeContract } from "./route-contract";

const bodySchema = z.object({
  title: z.string().min(1),
});

export const POST = procedure
  .forRoute(routeContract)
  .json(bodySchema)
  .output({
    _output: {
      ok: true as const,
      title: "" as string,
    },
  })
  .handle(async ({ json }) => ({
    status: 201,
    body: {
      ok: true,
      title: json.title,
    },
  }))
  .nextRoute({ method: "POST", onError });
