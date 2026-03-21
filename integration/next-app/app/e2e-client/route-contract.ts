import type { ProcedureRouteContract } from "rpc4next/server";

export type Params = {};
export type RouteContract = ProcedureRouteContract<"/e2e-client", Params>;

export const routeContract = {
  pathname: "/e2e-client",
  params: {} as Params,
} as RouteContract;