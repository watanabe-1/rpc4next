import type { TypedNextResponse } from "./types";

export type RouteResponse = TypedNextResponse | Promise<TypedNextResponse | undefined>;

export interface ValidationSchema {
  input: {};
  output: {};
}

export type RouteHandlerResponse<
  TRouteResponse extends RouteResponse,
  // Kept for type inference from RouteHandler on the client side.
  _TValidationSchema extends ValidationSchema,
> = Promise<Exclude<Awaited<TRouteResponse>, undefined>>;
