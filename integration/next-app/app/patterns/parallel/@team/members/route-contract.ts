import type { ProcedureRouteContract } from "rpc4next/server";

export type Params = {};
export type RouteContract = ProcedureRouteContract<"/patterns/parallel/members", Params>;

export const routeContract = {
  pathname: "/patterns/parallel/members",
  params: {} as Params,
} as RouteContract;