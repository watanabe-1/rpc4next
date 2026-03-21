import type { ProcedureRouteContract } from "rpc4next/server";

export type Params = {};
export type RouteContract = ProcedureRouteContract<"/patterns/reports", Params>;

export const routeContract = {
  pathname: "/patterns/reports",
  params: {} as Params,
} as RouteContract;