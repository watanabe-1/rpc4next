import type { ProcedureRouteContract } from "rpc4next/server";

export type Params = {};
export type RouteContract = ProcedureRouteContract<"/", Params>;

export const routeContract = {
  pathname: "/",
  params: {} as Params,
} as RouteContract;