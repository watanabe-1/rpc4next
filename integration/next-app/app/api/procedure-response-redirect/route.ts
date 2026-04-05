import { nextRoute, procedure } from "rpc4next/server";
import { onError } from "../_shared/on-error";
import { routeContract } from "./route-contract";

const getProcedureResponseRedirect = procedure
  .forRoute(routeContract)
  .handle(async ({ response }) =>
    response.redirect("http://127.0.0.1:3000/feed"),
  );

export const GET = nextRoute(getProcedureResponseRedirect, {
  method: "GET",
  onError,
});
