import type { ProcedureRouteContract } from "rpc4next/server";

export type Params = {};
export type RouteContract = ProcedureRouteContract<"/api/procedure-invalid-output", Params>;

export const routeContract = {
  pathname: "/api/procedure-invalid-output",
  params: {} as Params,
} as RouteContract;