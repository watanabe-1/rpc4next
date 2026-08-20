import type { TypedNextResponse } from "rpc4next/server";

import { appProcedure } from "../_shared/procedure-defaults";
import { routeContract } from "./route-contract";

export const { GET } = appProcedure
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
