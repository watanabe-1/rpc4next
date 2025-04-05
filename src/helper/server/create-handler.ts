import type { ValidationSchema, RouteResponse, Handler } from "./route-types";
import type { Params, Query } from "./types";

// I want to use currying so that the return value can be inferred.
export const createHandler = <
  TParams extends Params,
  TQuery extends Query,
  TValidationSchema extends ValidationSchema,
>() => {
  return <TRouteResponse extends RouteResponse>(
    handler: Handler<TParams, TQuery, TValidationSchema, TRouteResponse>
  ) => {
    return handler;
  };
};
