import type { ProcedureRouteContract } from "rpc4next/server";

export type Params = {};
export type RouteContract = ProcedureRouteContract<"/api/error-demo", Params>;

export const routeContract = {
  pathname: "/api/error-demo",
  params: {} as Params,
} as RouteContract;