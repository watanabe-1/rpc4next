import type { ProcedureRouteContract } from "rpc4next/server";

export type Params = {};
export type RouteContract = ProcedureRouteContract<"/api/procedure-response-text", Params>;

export const routeContract = {
  pathname: "/api/procedure-response-text",
  params: {} as Params,
} as RouteContract;