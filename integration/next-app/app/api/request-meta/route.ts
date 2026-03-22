import { nextRoute, procedure } from "rpc4next/server";
import { z } from "zod";
import { routeContract } from "./route-contract";

const headersSchema = z.object({
  "x-integration-test": z.string().min(1),
});

const cookiesSchema = z.object({
  session: z.string().min(1),
});

const getRequestMeta = procedure
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
  }));

export const GET = nextRoute(getRequestMeta, { method: "GET" });
