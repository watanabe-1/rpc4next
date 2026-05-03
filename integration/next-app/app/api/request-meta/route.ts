import { procedure } from "rpc4next/server";
import { z } from "zod";

import { onError } from "../_shared/on-error";
import { routeContract } from "./route-contract";

const headersSchema = z.object({
  "x-integration-test": z.string().min(1),
});

const cookiesSchema = z.object({
  session: z.string().min(1),
});

export const GET = procedure
  .forRoute(routeContract)
  .headers(headersSchema)
  .cookies(cookiesSchema)
  .output({
    _output: {
      header: "" as string,
      session: "" as string,
    },
  })
  .handle(async ({ headers, cookies }) => ({
    body: {
      header: headers["x-integration-test"],
      session: cookies.session,
    },
  }))
  .nextRoute({ method: "GET", onError });
