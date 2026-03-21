import type { ProcedureRouteContract } from "rpc4next/server";

export type Params = { "id": string };
export type RouteContract = ProcedureRouteContract<"/photo/[id]", Params>;

export const routeContract = {
  pathname: "/photo/[id]",
  params: {} as Params,
} as RouteContract;