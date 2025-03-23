import { createRouteContext } from "./create-route-context";
import type {
  Query,
  Params,
  RouteBindings,
  ValidationSchema,
  Handler,
  MethodRouteDefinition,
  RequiredRouteResponse,
  ErrorHandler,
} from "./types";
import type { HTTP_METHOD } from "next/dist/server/web/http";
import type { NextRequest } from "next/server";

const composeHandlersWithError = <
  TParams extends Params,
  TQuery extends Query,
  TValidationSchema extends ValidationSchema,
  THandlers extends Handler<TParams, TQuery, TValidationSchema>[],
  TOnErrorResponse extends RequiredRouteResponse,
>(
  handlers: THandlers,
  onError: ErrorHandler<TOnErrorResponse, TParams, TQuery, TValidationSchema>
) => {
  return async (
    req: NextRequest,
    segmentData: { params: Promise<TParams> }
  ) => {
    const routeContext = createRouteContext<TParams, TQuery, TValidationSchema>(
      req,
      segmentData
    );

    try {
      for (const handler of handlers) {
        const result = await handler(routeContext);
        if (result instanceof Response) {
          return result;
        }
      }

      throw new Error("No handler returned a response");
    } catch (error) {
      return await onError(error, routeContext);
    }
  };
};

export const routeHandlerFactory =
  <TOnErrorResponse extends RequiredRouteResponse = never>(
    onError?: ErrorHandler<TOnErrorResponse>
  ) =>
  <TBindings extends RouteBindings>() => {
    const defineRouteForMethod = <THttpMethod extends HTTP_METHOD>(
      method: THttpMethod
    ) => {
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      return ((...handlers: any[]) => {
        const resolvedOnError =
          onError ??
          ((error, _) => {
            throw error;
          });

        const routeHandler = composeHandlersWithError(
          handlers,
          resolvedOnError
        );
        return { [method]: routeHandler } as Record<
          THttpMethod,
          typeof routeHandler
        >;
      }) as MethodRouteDefinition<THttpMethod, TBindings, TOnErrorResponse>;
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
