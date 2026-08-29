import type { TypedNextResponse } from "rpc4next/server";

import { appRouteProcedure } from "../../_rpc/route-procedure";
import { routeContract } from "./route-contract";

export const { GET } = appRouteProcedure
  .forRoute(routeContract)
  .meta({
    summary: "Contract route example",
    tags: ["contract-route"],
  })
  .output<{
    ok: true;
    source: "contract-route";
  }>()
  .handle(
    async ({
      response,
    }): Promise<
      TypedNextResponse<
        {
          ok: boolean;
          source: string;
        },
        200,
        "application/json"
      >
    > =>
      response.json({
        ok: true,
        source: "contract-route",
      }),
  )
  .nextRoute({ method: "GET" });
