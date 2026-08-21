import { z } from "zod";

import { appRouteProcedure } from "../_shared/procedure-defaults";
import { routeContract } from "./route-contract";

const bodySchema = z.object({
  title: z.string().min(1),
});

export const { POST } = appRouteProcedure
  .forRoute(routeContract)
  .json(bodySchema)
  .output<{
    ok: true;
    title: string;
  }>()
  .handle(async ({ json }) => ({
    status: 201,
    body: {
      ok: true,
      title: json.title,
    },
  }))
  .nextRoute({ method: "POST" });
