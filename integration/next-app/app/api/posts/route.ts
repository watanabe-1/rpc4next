import { z } from "zod";

import { appRouteProcedure } from "../../_rpc/route-procedure";
import { routeContract } from "./route-contract";

const bodySchema = z.object({
  title: z.string().min(1),
});

export const { POST } = appRouteProcedure
  .forRoute(routeContract)
  .json(bodySchema)
  .handle(async ({ json }) => ({
    status: 201,
    body: {
      ok: true as const,
      title: json.title,
    },
  }))
  .post();
