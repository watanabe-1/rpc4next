import type { ProcedureRouteContract } from "rpc4next/server";

export type Params = {};
export type RouteContract = ProcedureRouteContract<"/api/procedure-defaults-error", Params>;

export const routeContract = {
  pathname: "/api/procedure-defaults-error",
  params: {} as Params,
} as RouteContract;