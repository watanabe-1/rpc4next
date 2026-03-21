import type { ProcedureRouteContract } from "rpc4next/server";

export type Params = {};
export type RouteContract = ProcedureRouteContract<"/patterns/%5Fescaped", Params>;

export const routeContract = {
  pathname: "/patterns/%5Fescaped",
  params: {} as Params,
} as RouteContract;