import type { ProcedureRouteContract } from "rpc4next/server";

export type Params = {};
export type RouteContract = ProcedureRouteContract<"/api/contract-route", Params>;

export const routeContract = {
  pathname: "/api/contract-route",
  params: {} as Params,
} as RouteContract;