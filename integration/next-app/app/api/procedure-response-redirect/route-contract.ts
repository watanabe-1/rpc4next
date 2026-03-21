import type { ProcedureRouteContract } from "rpc4next/server";

export type Params = {};
export type RouteContract = ProcedureRouteContract<"/api/procedure-response-redirect", Params>;

export const routeContract = {
  pathname: "/api/procedure-response-redirect",
  params: {} as Params,
} as RouteContract;