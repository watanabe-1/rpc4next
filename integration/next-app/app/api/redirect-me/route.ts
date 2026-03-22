import { nextRoute, procedure } from "rpc4next/server";
import { routeContract } from "./route-contract";

const redirectProcedure = procedure
  .forRoute(routeContract)
  .handle(async ({ response }) =>
    response.redirect("http://127.0.0.1:3000/feed"),
  );

export const GET = nextRoute(redirectProcedure, { method: "GET" });
