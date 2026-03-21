import type { ProcedureRouteContract } from "rpc4next/server";

export type Params = { "itemId": string };
export type RouteContract = ProcedureRouteContract<"/api/next-native/[itemId]", Params>;

export const routeContract = {
  pathname: "/api/next-native/[itemId]",
  params: {} as Params,
} as RouteContract;