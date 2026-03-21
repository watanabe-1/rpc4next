import type { ProcedureRouteContract } from "rpc4next/server";

export type Params = {};
export type RouteContract = ProcedureRouteContract<"/api/procedure-form-data", Params>;

export const routeContract = {
  pathname: "/api/procedure-form-data",
  params: {} as Params,
} as RouteContract;