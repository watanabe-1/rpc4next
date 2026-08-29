import { appRouteProcedure } from "../../_rpc/route-procedure";
import { routeContract } from "./route-contract";

export const { GET } = appRouteProcedure
  .forRoute(routeContract)
  .handle(async () => {
    throw new Error("expected integration failure");
  })
  .nextRoute({
    method: "GET",
    onError: (error) => {
      const message = error instanceof Error ? error.message : "unknown integration error";

      return new Response(`handled:${message}`, {
        status: 500,
        headers: {
          "content-type": "text/plain; charset=utf-8",
        },
      });
    },
  });
