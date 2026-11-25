import { appRouteProcedure } from "../../_rpc/route-procedure";
import { routeContract } from "./route-contract";

export const { GET } = appRouteProcedure
  .forRoute(routeContract)
  .meta({
    summary: "Contract route example",
    tags: ["contract-route"],
  })
  .handle(async ({ response }) => response.json({ ok: true, source: "contract-route" as const }))
  .get();
