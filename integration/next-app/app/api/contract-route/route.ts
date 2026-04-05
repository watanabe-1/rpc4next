import { nextRoute, procedure, type TypedNextResponse } from "rpc4next/server";
import { onError } from "../_shared/on-error";
import { routeContract } from "./route-contract";

const contractRoute = procedure
  .forRoute(routeContract)
  .meta({
    tags: ["contract-route"],
    auth: "optional",
  })
  .output({
    _output: {
      ok: true as const,
      source: "contract-route" as const,
    },
  })
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
  );

export const GET = nextRoute(contractRoute, { method: "GET", onError });
