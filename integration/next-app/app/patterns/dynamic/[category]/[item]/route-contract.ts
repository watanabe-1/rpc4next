import type { ProcedureRouteContract } from "rpc4next/server";

export type Params = { "category": string; "item": string; };
export type RouteContract = ProcedureRouteContract<"/patterns/dynamic/[category]/[item]", Params>;

export const routeContract = {
  pathname: "/patterns/dynamic/[category]/[item]",
  params: {} as Params,
} as RouteContract;