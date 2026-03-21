import type { ProcedureRouteContract } from "rpc4next/server";

export type Params = {};
export type RouteContract = ProcedureRouteContract<"/patterns", Params>;

export const routeContract = {
  pathname: "/patterns",
  params: {} as Params,
} as RouteContract;