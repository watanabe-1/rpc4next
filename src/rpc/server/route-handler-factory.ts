/*!
 * Inspired by Hono (https://github.com/honojs/hono),
 * particularly its routing design and handler interface.
 */

import { createRouteContext } from "./route-context";
import type {
  ValidationSchema,
  Handler,
  RequiredRouteResponse,
  ErrorHandler,
  RouteBindings,
  MethodRouteDefinition,
} from "./route-types";
import type { Query, Params } from "./types";
import type { HttpMethod } from "../lib/types";
import type { NextRequest } from "next/server";

const composeHandlersWithError = <
  THttpMethod extends HttpMethod,
  TParams extends Params,
  TQuery extends Query,
  TValidationSchema extends ValidationSchema,
  THandlers extends Handler<THttpMethod, TParams, TQuery, TValidationSchema>[],
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

/**
 * A factory function that creates route handlers for various HTTP methods (GET, POST, etc.).
 *
 * Optionally accepts a global error handler that will be used if any route handler throws.
 *
 * Example usage:
 * ```ts
 * const createRouteHandler = routeHandlerFactory((err, rc) => rc.text("error", {status : 400}));
 * export const { POST } = createRouteHandler<{ params: ..., query: ... }>().post((rc) => rc.json({success: true}));
 * ```
 *
 * @template TOnErrorResponse Type of the response returned by the error handler (optional)
 * @param onError Optional global error handler. If not provided, errors will be re-thrown.
 * @returns An object with methods (`get`, `post`, `put`, etc.) to define route handlers for each HTTP method
 */
export const routeHandlerFactory =
  <TOnErrorResponse extends RequiredRouteResponse = never>(
    onError?: ErrorHandler<TOnErrorResponse>
  ) =>
  <TBindings extends RouteBindings>() => {
    const defineRouteForMethod = <THttpMethod extends HttpMethod>(
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
