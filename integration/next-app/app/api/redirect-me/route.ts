import { procedure } from "rpc4next/server";

import { onError } from "../_shared/on-error";
import { routeContract } from "./route-contract";

export const GET = procedure
  .forRoute(routeContract)
  .handle(async ({ response }) => response.redirect("http://127.0.0.1:3000/feed"))
  .nextRoute({ method: "GET", onError });
