import type { ProcedureRouteContract } from "rpc4next/server";

export type Params = {};
export type RouteContract = ProcedureRouteContract<"/api/procedure-submit", Params>;

export const routeContract = {
  pathname: "/api/procedure-submit",
  params: {} as Params,
} as RouteContract;