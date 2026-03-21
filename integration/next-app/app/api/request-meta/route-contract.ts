import type { ProcedureRouteContract } from "rpc4next/server";

export type Params = {};
export type RouteContract = ProcedureRouteContract<"/api/request-meta", Params>;

export const routeContract = {
  pathname: "/api/request-meta",
  params: {} as Params,
} as RouteContract;