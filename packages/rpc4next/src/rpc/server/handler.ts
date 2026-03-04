import type { HttpMethod } from "rpc4next-shared";
import type { Handler, RouteResponse, ValidationSchema } from "./route-types";
import type { Params, Query } from "./types";

// I want to use currying so that the return value can be inferred.
export const createHandler = <
  THttpMethod extends HttpMethod,
  TParams extends Params,
  TQuery extends Query,
  TValidationSchema extends ValidationSchema,
>() => {
  return <TRouteResponse extends RouteResponse>(
    handler: Handler<
      THttpMethod,
      TParams,
      TQuery,
      TValidationSchema,
      TRouteResponse
    >,
  ) => {
    return handler;
  };
};
