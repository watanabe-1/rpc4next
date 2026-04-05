import { procedure } from "rpc4next/server";
import { z } from "zod";
import { onError } from "../_shared/on-error";
import { routeContract } from "./route-contract";

export const POST = procedure
  .forRoute(routeContract)
  .formData(
    z.object({
      displayName: z.string().min(1),
      avatar: z.instanceof(File),
      tags: z.array(z.string()).optional(),
    }),
  )
  .output({
    _output: {
      ok: true as const,
      displayName: "" as string,
      filename: "" as string,
      tags: [] as string[],
      source: "procedure-form-data" as const,
    },
  })
  .handle(async ({ formData }) => ({
    status: 200,
    body: {
      ok: true,
      displayName: formData.displayName,
      filename: formData.avatar.name,
      tags: formData.tags ?? [],
      source: "procedure-form-data",
    },
  }))
  .nextRoute({ method: "POST", onError });
