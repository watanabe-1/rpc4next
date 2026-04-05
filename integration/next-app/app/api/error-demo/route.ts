import { nextRoute, procedure } from "rpc4next/server";
import { routeContract } from "./route-contract";

const failingProcedure = procedure.forRoute(routeContract).handle(async () => {
  throw new Error("expected integration failure");
});

export const GET = nextRoute(failingProcedure, {
  method: "GET",
  onError: (error) => {
    const message =
      error instanceof Error ? error.message : "unknown integration error";

    return new Response(`handled:${message}`, {
      status: 500,
      headers: {
        "content-type": "text/plain; charset=utf-8",
      },
    });
  },
});
