import type { Handler, Params, Query, RouteResponse, Validated } from "./types";

// I want to use currying so that the return value can be inferred.
export const createHandler = <
  TParams extends Params,
  TQuery extends Query,
  TValidated extends Validated,
>() => {
  return <TRouteResponse extends RouteResponse>(
    handler: Handler<TParams, TQuery, TValidated, TRouteResponse>
  ) => {
    return handler;
  };
};
