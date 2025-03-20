import type { Handler, Params, Query, RouteResponse, Validated } from "./types";

// I want to use currying so that the return value can be inferred.
export const createHandler = <
  TParams extends Params,
  TQuery extends Query,
  TValidateds extends Validated[],
>() => {
  return <TRouteResponse extends RouteResponse>(
    handler: Handler<TParams, TQuery, TValidateds, TRouteResponse>
  ) => {
    return handler;
  };
};
