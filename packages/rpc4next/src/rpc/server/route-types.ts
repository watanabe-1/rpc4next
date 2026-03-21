/*!
 * Portions of this code are based on the Hono project (https://github.com/honojs/hono),
 * originally created by Yusuke Wada (https://github.com/yusukebe) and developed with
 * contributions from the Hono community.
 * This code has been adapted and modified for this project.
 * Original copyright belongs to Yusuke Wada and the Hono project contributors.
 * Hono is licensed under the MIT License.
 */

import type { NextRequest } from "next/server";
import type { HttpMethod } from "rpc4next-shared";
import type { RpcErrorCode } from "./error";
import type { RpcMeta } from "./meta";
import type {
  AppendProcedureErrorDefinition,
  MergeProcedureDefinition,
  ProcedureDefinition,
  ProcedureErrorContract,
  WithProcedureDefinition,
} from "./procedure-types";
import type { Params, Query, RouteContext, TypedNextResponse } from "./types";

export type RouteResponse =
  | TypedNextResponse
  | Promise<TypedNextResponse | undefined>;

export type RequiredRouteResponse =
  | TypedNextResponse
  | Promise<TypedNextResponse>;

export interface RouteBindings {
  params?: Params | Promise<Params>;
  query?: Query;
}

export interface ValidationSchema {
  // biome-ignore lint/complexity/noBannedTypes: empty object contract is intentional
  input: {};
  // biome-ignore lint/complexity/noBannedTypes: empty object contract is intentional
  output: {};
}

export type Handler<
  // _THttpMethod is used to propagate the current HttpMethod type to the Handler.
  _THttpMethod extends HttpMethod,
  TParams = Params,
  TQuery = Query,
  TValidationSchema extends ValidationSchema = ValidationSchema,
  TRouteResponse extends RouteResponse = RouteResponse,
> = (
  routeContext: RouteContext<TParams, TQuery, TValidationSchema>,
) => TRouteResponse;

export type ErrorHandler<
  TRouteResponse extends RequiredRouteResponse,
  TParams = Params,
  TQuery = Query,
  TValidationSchema extends ValidationSchema = ValidationSchema,
> = (
  error: unknown,
  routeContext: RouteContext<TParams, TQuery, TValidationSchema>,
) => TRouteResponse;

export type RouteHandlerResponse<
  TRouteResponse extends RouteResponse,
  // _TValidationSchema is used as a generic to allow referencing the ValidationSchema on the client side.
  _TValidationSchema extends ValidationSchema,
> =
  // Exclude void | undefined because a response is always returned or an error is thrown internally
  Promise<Exclude<Awaited<TRouteResponse>, undefined | undefined>>;

export type RouteHandler<
  TParams extends RouteBindings["params"],
  TRouteResponse extends RouteResponse,
  TValidationSchema extends ValidationSchema,
  TProcedureDefinition extends ProcedureDefinition = Record<never, never>,
> = WithProcedureDefinition<
  (
    req: NextRequest,
    segmentData: { params: Promise<TParams> },
  ) => RouteHandlerResponse<TRouteResponse, TValidationSchema>,
  TProcedureDefinition
>;

type HttpMethodMapping<
  THttpMethod extends HttpMethod,
  TParams extends RouteBindings["params"],
  TRouteResponse extends RouteResponse,
  TValidationSchema extends ValidationSchema,
  TProcedureDefinition extends ProcedureDefinition = ProcedureDefinition,
> = Record<
  THttpMethod,
  RouteHandler<
    TParams,
    TRouteResponse,
    TValidationSchema,
    MergeProcedureDefinition<TProcedureDefinition, { method: THttpMethod }>
  >
>;

export interface MethodRouteDefinition<
  THttpMethod extends HttpMethod,
  TBindings extends RouteBindings,
  TOnErrorResponse extends RequiredRouteResponse,
  TProcedureDefinition extends ProcedureDefinition = Record<never, never>,
  TParams extends TBindings["params"] = TBindings extends {
    params: infer TValue;
  }
    ? Awaited<TValue>
    : Params,
  TQuery extends TBindings["query"] = TBindings extends { query: infer TValue }
    ? TValue
    : Query,
> {
  // 1 handler
  <
    TV1 extends ValidationSchema = ValidationSchema,
    TR1 extends RequiredRouteResponse = RequiredRouteResponse,
  >(
    handler: Handler<THttpMethod, TParams, TQuery, TV1, TR1>,
  ): HttpMethodMapping<
    THttpMethod,
    TParams,
    TR1 | TOnErrorResponse,
    TV1,
    TProcedureDefinition
  >;

  // 2 handlers
  <
    TV1 extends ValidationSchema = ValidationSchema,
    TV2 extends ValidationSchema = TV1,
    TR1 extends RouteResponse = RouteResponse,
    TR2 extends RequiredRouteResponse = RequiredRouteResponse,
  >(
    handler1: Handler<THttpMethod, TParams, TQuery, TV1, TR1>,
    handler2: Handler<THttpMethod, TParams, TQuery, TV2, TR2>,
  ): HttpMethodMapping<
    THttpMethod,
    TParams,
    TR1 | TR2 | TOnErrorResponse,
    TV2,
    TProcedureDefinition
  >;

  // 3 handlers
  <
    TV1 extends ValidationSchema = ValidationSchema,
    TV2 extends ValidationSchema = TV1,
    TV3 extends ValidationSchema = TV1 & TV2,
    TR1 extends RouteResponse = RouteResponse,
    TR2 extends RouteResponse = RouteResponse,
    TR3 extends RequiredRouteResponse = RequiredRouteResponse,
  >(
    handler1: Handler<THttpMethod, TParams, TQuery, TV1, TR1>,
    handler2: Handler<THttpMethod, TParams, TQuery, TV2, TR2>,
    handler3: Handler<THttpMethod, TParams, TQuery, TV3, TR3>,
  ): HttpMethodMapping<
    THttpMethod,
    TParams,
    TR1 | TR2 | TR3 | TOnErrorResponse,
    TV3,
    TProcedureDefinition
  >;

  // 4 handlers
  <
    TV1 extends ValidationSchema = ValidationSchema,
    TV2 extends ValidationSchema = TV1,
    TV3 extends ValidationSchema = TV1 & TV2,
    TV4 extends ValidationSchema = TV1 & TV2 & TV3,
    TR1 extends RouteResponse = RouteResponse,
    TR2 extends RouteResponse = RouteResponse,
    TR3 extends RouteResponse = RouteResponse,
    TR4 extends RequiredRouteResponse = RequiredRouteResponse,
  >(
    handler1: Handler<THttpMethod, TParams, TQuery, TV1, TR1>,
    handler2: Handler<THttpMethod, TParams, TQuery, TV2, TR2>,
    handler3: Handler<THttpMethod, TParams, TQuery, TV3, TR3>,
    handler4: Handler<THttpMethod, TParams, TQuery, TV4, TR4>,
  ): HttpMethodMapping<
    THttpMethod,
    TParams,
    TR1 | TR2 | TR3 | TR4 | TOnErrorResponse,
    TV4,
    TProcedureDefinition
  >;

  // 5 handlers
  <
    TV1 extends ValidationSchema = ValidationSchema,
    TV2 extends ValidationSchema = TV1,
    TV3 extends ValidationSchema = TV1 & TV2,
    TV4 extends ValidationSchema = TV1 & TV2 & TV3,
    TV5 extends ValidationSchema = TV1 & TV2 & TV3 & TV4,
    TR1 extends RouteResponse = RouteResponse,
    TR2 extends RouteResponse = RouteResponse,
    TR3 extends RouteResponse = RouteResponse,
    TR4 extends RouteResponse = RouteResponse,
    TR5 extends RequiredRouteResponse = RequiredRouteResponse,
  >(
    handler1: Handler<THttpMethod, TParams, TQuery, TV1, TR1>,
    handler2: Handler<THttpMethod, TParams, TQuery, TV2, TR2>,
    handler3: Handler<THttpMethod, TParams, TQuery, TV3, TR3>,
    handler4: Handler<THttpMethod, TParams, TQuery, TV4, TR4>,
    handler5: Handler<THttpMethod, TParams, TQuery, TV5, TR5>,
  ): HttpMethodMapping<
    THttpMethod,
    TParams,
    TR1 | TR2 | TR3 | TR4 | TR5 | TOnErrorResponse,
    TV5,
    TProcedureDefinition
  >;

  // 6 handlers
  <
    TV1 extends ValidationSchema = ValidationSchema,
    TV2 extends ValidationSchema = TV1,
    TV3 extends ValidationSchema = TV1 & TV2,
    TV4 extends ValidationSchema = TV1 & TV2 & TV3,
    TV5 extends ValidationSchema = TV1 & TV2 & TV3 & TV4,
    TV6 extends ValidationSchema = TV1 & TV2 & TV3 & TV4 & TV5,
    TR1 extends RouteResponse = RouteResponse,
    TR2 extends RouteResponse = RouteResponse,
    TR3 extends RouteResponse = RouteResponse,
    TR4 extends RouteResponse = RouteResponse,
    TR5 extends RouteResponse = RouteResponse,
    TR6 extends RequiredRouteResponse = RequiredRouteResponse,
  >(
    handler1: Handler<THttpMethod, TParams, TQuery, TV1, TR1>,
    handler2: Handler<THttpMethod, TParams, TQuery, TV2, TR2>,
    handler3: Handler<THttpMethod, TParams, TQuery, TV3, TR3>,
    handler4: Handler<THttpMethod, TParams, TQuery, TV4, TR4>,
    handler5: Handler<THttpMethod, TParams, TQuery, TV5, TR5>,
    handler6: Handler<THttpMethod, TParams, TQuery, TV6, TR6>,
  ): HttpMethodMapping<
    THttpMethod,
    TParams,
    TR1 | TR2 | TR3 | TR4 | TR5 | TR6 | TOnErrorResponse,
    TV6,
    TProcedureDefinition
  >;
}

export interface RouteDefinitionBuilder<
  TBindings extends RouteBindings,
  TOnErrorResponse extends RequiredRouteResponse,
  TProcedureDefinition extends ProcedureDefinition = Record<never, never>,
> {
  meta<TMeta extends RpcMeta>(
    meta: TMeta,
  ): RouteDefinitionBuilder<
    TBindings,
    TOnErrorResponse,
    MergeProcedureDefinition<TProcedureDefinition, { meta: TMeta }>
  >;

  output<TOutput>(
    schema: { _output: TOutput } | { _type: TOutput } | { output: TOutput },
  ): RouteDefinitionBuilder<
    TBindings,
    TOnErrorResponse,
    MergeProcedureDefinition<
      TProcedureDefinition,
      { output: ProcedureDefinition["output"] & { response: TOutput } }
    >
  >;

  error<TCode extends RpcErrorCode, TDetails = unknown>(
    code: TCode,
  ): RouteDefinitionBuilder<
    TBindings,
    TOnErrorResponse,
    AppendProcedureErrorDefinition<
      TProcedureDefinition,
      ProcedureErrorContract<TCode, TDetails>
    >
  >;

  get: MethodRouteDefinition<
    "GET",
    TBindings,
    TOnErrorResponse,
    TProcedureDefinition
  >;
  post: MethodRouteDefinition<
    "POST",
    TBindings,
    TOnErrorResponse,
    TProcedureDefinition
  >;
  put: MethodRouteDefinition<
    "PUT",
    TBindings,
    TOnErrorResponse,
    TProcedureDefinition
  >;
  delete: MethodRouteDefinition<
    "DELETE",
    TBindings,
    TOnErrorResponse,
    TProcedureDefinition
  >;
  patch: MethodRouteDefinition<
    "PATCH",
    TBindings,
    TOnErrorResponse,
    TProcedureDefinition
  >;
  head: MethodRouteDefinition<
    "HEAD",
    TBindings,
    TOnErrorResponse,
    TProcedureDefinition
  >;
  options: MethodRouteDefinition<
    "OPTIONS",
    TBindings,
    TOnErrorResponse,
    TProcedureDefinition
  >;
}
