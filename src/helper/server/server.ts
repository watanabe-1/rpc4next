import { createRouteContext } from "./context";
import type {
  Query,
  Params,
  RouteBindings,
  ValidationSchema,
  Handler,
  CreateRoute,
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
  const createRoute = <THttpMethod extends HTTP_METHOD>(
    method: THttpMethod
  ) => {
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    return ((...handlers: any[]) => {
      const routeHandler = composeHandlers(handlers);

      return { [method]: routeHandler } as Record<
        THttpMethod,
        typeof routeHandler
      >;
    }) as CreateRoute<TBindings, THttpMethod>;
  };

  return {
    get: createRoute("GET"),
    post: createRoute("POST"),
    put: createRoute("PUT"),
    delete: createRoute("DELETE"),
    patch: createRoute("PATCH"),
    head: createRoute("HEAD"),
    options: createRoute("OPTIONS"),
  };
};
