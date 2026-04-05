import { nextRoute, procedure } from "rpc4next/server";
import { z } from "zod";
import { onError } from "../_shared/on-error";
import { routeContract } from "./route-contract";

const bodySchema = z.object({
  title: z.string().min(1),
});

const postRoute = procedure
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
  }));

export const POST = nextRoute(postRoute, { method: "POST", onError });
