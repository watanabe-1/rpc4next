import type { ProcedureRouteContract } from "rpc4next/server";

export type Params = {};
export type RouteContract = ProcedureRouteContract<"/patterns/parallel/views", Params>;

export const routeContract = {
  pathname: "/patterns/parallel/views",
  params: {} as Params,
} as RouteContract;