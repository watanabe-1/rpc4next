import type { ProcedureRouteContract } from "rpc4next/server";

export type Params = { "userId": string };
export type RouteContract = ProcedureRouteContract<"/api/procedure-guarded/[userId]", Params>;

export const routeContract = {
  pathname: "/api/procedure-guarded/[userId]",
  params: {} as Params,
} as RouteContract;