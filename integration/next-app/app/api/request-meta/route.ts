import { z } from "zod";

import { appRouteProcedure } from "../../_rpc/route-procedure";
import { routeContract } from "./route-contract";

const headersSchema = z.object({
  "x-integration-test": z.string().min(1),
});

const cookiesSchema = z.object({
  session: z.string().min(1),
});

export const { GET } = appRouteProcedure
  .forRoute(routeContract)
  .headers(headersSchema)
  .cookies(cookiesSchema)
  .output<{
    header: string;
    session: string;
  }>()
  .handle(async ({ headers, cookies }) => ({
    body: {
      header: headers["x-integration-test"],
      session: cookies.session,
    },
  }))
  .nextRoute({ method: "GET" });
