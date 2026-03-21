import type { ProcedureRouteContract } from "rpc4next/server";

export type Params = { "parts": string[] | undefined };
export type RouteContract = ProcedureRouteContract<"/patterns/optional-catch-all/[[...parts]]", Params>;

export const routeContract = {
  pathname: "/patterns/optional-catch-all/[[...parts]]",
  params: {} as Params,
} as RouteContract;