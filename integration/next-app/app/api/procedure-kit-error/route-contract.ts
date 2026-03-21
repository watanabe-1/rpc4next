import type { ProcedureRouteContract } from "rpc4next/server";

export type Params = {};
export type RouteContract = ProcedureRouteContract<"/api/procedure-kit-error", Params>;

export const routeContract = {
  pathname: "/api/procedure-kit-error",
  params: {} as Params,
} as RouteContract;