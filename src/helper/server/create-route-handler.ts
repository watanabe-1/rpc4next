import { createRouteContext } from "./create-route-context";
import type {
  Query,
  Params,
  RouteBindings,
  ValidationSchema,
  Handler,
  MethodRouteDefinition,
} from "./types";
import type { HTTP_METHOD } from "next/dist/server/web/http";
import type { NextRequest } from "next/server";

const composeHandlers = <
  TParams extends Params,
  TQuery extends Query,
  TValidationSchema extends ValidationSchema,
  THandlers extends Handler<TParams, TQuery, TValidationSchema>[],
>(
  handlers: THandlers
) => {
  return async (
    req: NextRequest,
    segmentData: { params: Promise<TParams> }
  ) => {
    const routeContext = createRouteContext<TParams, TQuery, TValidationSchema>(
      req,
      segmentData
    );

    // Execute the handlers in order, and stop if a Response is returned
    for (const handler of handlers) {
      const result = await handler(routeContext);
      if (result instanceof Response) {
        return result;
      }
    }

    throw new Error("No handler returned a response");
  };
};

export const createRouteHandler = <TBindings extends RouteBindings>() => {
  const defineRouteForMethod = <THttpMethod extends HTTP_METHOD>(
    method: THttpMethod
  ) => {
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    return ((...handlers: any[]) => {
      const routeHandler = composeHandlers(handlers);

      return { [method]: routeHandler } as Record<
        THttpMethod,
        typeof routeHandler
      >;
    }) as MethodRouteDefinition<THttpMethod, TBindings>;
  };

  return {
    get: defineRouteForMethod("GET"),
    post: defineRouteForMethod("POST"),
    put: defineRouteForMethod("PUT"),
    delete: defineRouteForMethod("DELETE"),
    patch: defineRouteForMethod("PATCH"),
    head: defineRouteForMethod("HEAD"),
    options: defineRouteForMethod("OPTIONS"),
  };
};
