import type { ProcedureRouteContract } from "rpc4next/server";

export type Params = { "id": string; "commentId": string; };
export type RouteContract = ProcedureRouteContract<"/feed/photo/[id]/comments/[commentId]", Params>;

export const routeContract = {
  pathname: "/feed/photo/[id]/comments/[commentId]",
  params: {} as Params,
} as RouteContract;