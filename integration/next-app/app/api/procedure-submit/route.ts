import { z } from "zod";

import { appRouteProcedure } from "../../_rpc/route-procedure";
import { routeContract } from "./route-contract";

export const { POST } = appRouteProcedure
  .forRoute(routeContract)
  .headers(
    z.object({
      "x-procedure-test": z.string().min(1),
    }),
  )
  .cookies(
    z.object({
      session: z.string().min(1),
    }),
  )
  .json(
    z.object({
      title: z.string().min(1),
    }),
  )
  .handle(async ({ json, headers, cookies }) => ({
    status: 201,
    body: {
      ok: true as const,
      title: json.title,
      header: headers["x-procedure-test"],
      session: cookies.session,
      source: "procedure-submit" as const,
    },
  }))
  .post();
