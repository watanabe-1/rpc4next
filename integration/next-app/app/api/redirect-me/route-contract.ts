import type { ProcedureRouteContract } from "rpc4next/server";

export type Params = {};
export type RouteContract = ProcedureRouteContract<"/api/redirect-me", Params>;

export const routeContract = {
  pathname: "/api/redirect-me",
  params: {} as Params,
} as RouteContract;