import type { ProcedureRouteContract } from "rpc4next/server";

export type Params = {};
export type RouteContract = ProcedureRouteContract<"/patterns/_escaped", Params>;

export const routeContract = {
  pathname: "/patterns/_escaped",
  params: {} as Params,
} as RouteContract;