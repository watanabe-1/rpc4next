import { appRouteProcedure } from "../../_rpc/route-procedure";
import { routeContract } from "./route-contract";

export const { GET } = appRouteProcedure
  .forRoute(routeContract)
  .handle(async ({ response }) => response.redirect("http://127.0.0.1:3000/feed"))
  .nextRoute({
    method: "GET",
  });
