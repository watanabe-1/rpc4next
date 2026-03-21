/*!
 * Inspired by Hono (https://github.com/honojs/hono),
 * particularly its routing design and handler interface.
 */

import type { NextRequest } from "next/server";
import type { HttpMethod } from "rpc4next-shared";
import type { RpcErrorCode } from "./error";
import type { RpcMeta } from "./meta";
import {
  executePipeline,
  normalizeRpcErrorResponse,
  withProcedureError,
  withProcedureMeta,
  withProcedureMethod,
  withProcedureOutput,
} from "./procedure-internals";
import type {
  AppendProcedureErrorDefinition,
  MergeProcedureDefinition,
  ProcedureDefinition,
  ProcedureErrorContract,
} from "./procedure-types";
import { attachProcedureDefinition } from "./procedure-types";
import { createRouteContext } from "./route-context";
import type {
  ErrorHandler,
  Handler,
  MethodRouteDefinition,
  RequiredRouteResponse,
  RouteBindings,
  RouteDefinitionBuilder,
  ValidationSchema,
} from "./route-types";
import type { Params, Query } from "./types";

const composeHandlersWithError = <
  THttpMethod extends HttpMethod,
  TParams extends Params,
  TQuery extends Query,
  TValidationSchema extends ValidationSchema,
  THandlers extends Handler<THttpMethod, TParams, TQuery, TValidationSchema>[],
  TOnErrorResponse extends RequiredRouteResponse,
>(
  handlers: THandlers,
  onError: ErrorHandler<TOnErrorResponse, TParams, TQuery, TValidationSchema>,
  hasCustomOnError: boolean,
) => {
  return async (
    req: NextRequest,
    segmentData: { params: Promise<TParams> },
  ) => {
    const routeContext = createRouteContext<TParams, TQuery, TValidationSchema>(
      req,
      segmentData,
    );

    try {
      const response = await executePipeline(handlers, routeContext, {
        isTerminal: (result): result is Exclude<typeof result, undefined> =>
          result !== undefined,
      });

      if (response) {
        return response;
      }

      throw new Error("No handler returned a response");
    } catch (error) {
      const rpcErrorResponse =
        !hasCustomOnError && normalizeRpcErrorResponse(error, routeContext);
      if (rpcErrorResponse) {
        return rpcErrorResponse;
      }

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
    onError?: ErrorHandler<TOnErrorResponse>,
  ) =>
  <TBindings extends RouteBindings>() => {
    const createBuilder = <
      TProcedureDefinition extends ProcedureDefinition = Record<never, never>,
    >(
      definition: Partial<TProcedureDefinition> = {},
    ): RouteDefinitionBuilder<
      TBindings,
      TOnErrorResponse,
      TProcedureDefinition
    > => {
      const defineRouteForMethod = <THttpMethod extends HttpMethod>(
        method: THttpMethod,
      ) => {
        // biome-ignore lint/suspicious/noExplicitAny: intentional for existing type patterns
        return ((...handlers: any[]) => {
          const resolvedOnError =
            onError ??
            ((error, _) => {
              throw error;
            });

          const routeHandler = composeHandlersWithError(
            handlers,
            resolvedOnError,
            onError !== undefined,
          );

          return {
            [method]: attachProcedureDefinition(
              routeHandler,
              withProcedureMethod(definition, method),
            ),
          } as Record<THttpMethod, typeof routeHandler>;
        }) as MethodRouteDefinition<
          THttpMethod,
          TBindings,
          TOnErrorResponse,
          TProcedureDefinition
        >;
      };

      return {
        meta: <TMeta extends RpcMeta>(meta: TMeta) =>
          createBuilder<
            MergeProcedureDefinition<TProcedureDefinition, { meta: TMeta }>
          >(
            withProcedureMeta(
              definition as TProcedureDefinition,
              meta,
            ) as Partial<
              MergeProcedureDefinition<TProcedureDefinition, { meta: TMeta }>
            >,
          ),
        output: <TOutput>(
          schema:
            | { _output: TOutput }
            | { _type: TOutput }
            | { output: TOutput },
        ) =>
          createBuilder<
            MergeProcedureDefinition<
              TProcedureDefinition,
              {
                output: NonNullable<TProcedureDefinition["output"]> & {
                  response: TOutput;
                };
              }
            >
          >(
            withProcedureOutput<TProcedureDefinition, TOutput, typeof schema>(
              definition as TProcedureDefinition,
              schema,
            ) as Partial<
              MergeProcedureDefinition<
                TProcedureDefinition,
                {
                  output: NonNullable<TProcedureDefinition["output"]> & {
                    response: TOutput;
                  };
                }
              >
            >,
          ),
        error: <TCode extends RpcErrorCode, TDetails = unknown>(code: TCode) =>
          createBuilder<
            AppendProcedureErrorDefinition<
              TProcedureDefinition,
              ProcedureErrorContract<TCode, TDetails>
            >
          >(
            withProcedureError<TProcedureDefinition, TCode, TDetails>(
              definition as TProcedureDefinition,
              code,
            ) as Partial<
              AppendProcedureErrorDefinition<
                TProcedureDefinition,
                ProcedureErrorContract<TCode, TDetails>
              >
            >,
          ),
        get: defineRouteForMethod("GET"),
        post: defineRouteForMethod("POST"),
        put: defineRouteForMethod("PUT"),
        delete: defineRouteForMethod("DELETE"),
        patch: defineRouteForMethod("PATCH"),
        head: defineRouteForMethod("HEAD"),
        options: defineRouteForMethod("OPTIONS"),
      } as unknown as RouteDefinitionBuilder<
        TBindings,
        TOnErrorResponse,
        TProcedureDefinition
      >;
    };

    return createBuilder();
  };
