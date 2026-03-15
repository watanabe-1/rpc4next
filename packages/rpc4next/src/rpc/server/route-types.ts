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
> = (
  req: NextRequest,
  segmentData: { params: Promise<TParams> },
) => RouteHandlerResponse<TRouteResponse, TValidationSchema>;

type HttpMethodMapping<
  THttpMethod extends HttpMethod,
  TParams extends RouteBindings["params"],
  TRouteResponse extends RouteResponse,
  TValidationSchema extends ValidationSchema,
> = Record<
  THttpMethod,
  RouteHandler<TParams, TRouteResponse, TValidationSchema>
>;

type RouteParamsForBindings<TBindings extends RouteBindings> =
  TBindings extends {
    params: infer TValue;
  }
    ? Awaited<TValue>
    : Params;

type RouteQueryForBindings<TBindings extends RouteBindings> =
  TBindings extends { query: infer TValue } ? TValue : Query;

type MethodRouteHandler<
  THttpMethod extends HttpMethod,
  TParams,
  TQuery,
  TValidationSchema extends ValidationSchema,
  TRouteResponse extends RouteResponse,
> = Handler<THttpMethod, TParams, TQuery, TValidationSchema, TRouteResponse>;

type MethodRouteMapping<
  THttpMethod extends HttpMethod,
  TParams extends RouteBindings["params"],
  TRouteResponse extends RouteResponse,
  TValidationSchema extends ValidationSchema,
  TOnErrorResponse extends RequiredRouteResponse,
> = HttpMethodMapping<
  THttpMethod,
  TParams,
  TRouteResponse | TOnErrorResponse,
  TValidationSchema
>;

export interface MethodRouteDefinition<
  THttpMethod extends HttpMethod,
  TBindings extends RouteBindings,
  TOnErrorResponse extends RequiredRouteResponse,
  TParams extends TBindings["params"] = RouteParamsForBindings<TBindings>,
  TQuery extends TBindings["query"] = RouteQueryForBindings<TBindings>,
> {
  // 1 handler
  <
    TV1 extends ValidationSchema = ValidationSchema,
    TR1 extends RequiredRouteResponse = RequiredRouteResponse,
  >(
    handler: MethodRouteHandler<THttpMethod, TParams, TQuery, TV1, TR1>,
  ): MethodRouteMapping<THttpMethod, TParams, TR1, TV1, TOnErrorResponse>;

  // 2 handlers
  <
    TV1 extends ValidationSchema = ValidationSchema,
    TV2 extends ValidationSchema = TV1,
    TR1 extends RouteResponse = RouteResponse,
    TR2 extends RequiredRouteResponse = RequiredRouteResponse,
  >(
    handler1: MethodRouteHandler<THttpMethod, TParams, TQuery, TV1, TR1>,
    handler2: MethodRouteHandler<THttpMethod, TParams, TQuery, TV2, TR2>,
  ): MethodRouteMapping<THttpMethod, TParams, TR1 | TR2, TV2, TOnErrorResponse>;

  // 3 handlers
  <
    TV1 extends ValidationSchema = ValidationSchema,
    TV2 extends ValidationSchema = TV1,
    TV3 extends ValidationSchema = TV1 & TV2,
    TR1 extends RouteResponse = RouteResponse,
    TR2 extends RouteResponse = RouteResponse,
    TR3 extends RequiredRouteResponse = RequiredRouteResponse,
  >(
    handler1: MethodRouteHandler<THttpMethod, TParams, TQuery, TV1, TR1>,
    handler2: MethodRouteHandler<THttpMethod, TParams, TQuery, TV2, TR2>,
    handler3: MethodRouteHandler<THttpMethod, TParams, TQuery, TV3, TR3>,
  ): MethodRouteMapping<
    THttpMethod,
    TParams,
    TR1 | TR2 | TR3,
    TV3,
    TOnErrorResponse
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
    handler1: MethodRouteHandler<THttpMethod, TParams, TQuery, TV1, TR1>,
    handler2: MethodRouteHandler<THttpMethod, TParams, TQuery, TV2, TR2>,
    handler3: MethodRouteHandler<THttpMethod, TParams, TQuery, TV3, TR3>,
    handler4: MethodRouteHandler<THttpMethod, TParams, TQuery, TV4, TR4>,
  ): MethodRouteMapping<
    THttpMethod,
    TParams,
    TR1 | TR2 | TR3 | TR4,
    TV4,
    TOnErrorResponse
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
    handler1: MethodRouteHandler<THttpMethod, TParams, TQuery, TV1, TR1>,
    handler2: MethodRouteHandler<THttpMethod, TParams, TQuery, TV2, TR2>,
    handler3: MethodRouteHandler<THttpMethod, TParams, TQuery, TV3, TR3>,
    handler4: MethodRouteHandler<THttpMethod, TParams, TQuery, TV4, TR4>,
    handler5: MethodRouteHandler<THttpMethod, TParams, TQuery, TV5, TR5>,
  ): MethodRouteMapping<
    THttpMethod,
    TParams,
    TR1 | TR2 | TR3 | TR4 | TR5,
    TV5,
    TOnErrorResponse
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
    handler1: MethodRouteHandler<THttpMethod, TParams, TQuery, TV1, TR1>,
    handler2: MethodRouteHandler<THttpMethod, TParams, TQuery, TV2, TR2>,
    handler3: MethodRouteHandler<THttpMethod, TParams, TQuery, TV3, TR3>,
    handler4: MethodRouteHandler<THttpMethod, TParams, TQuery, TV4, TR4>,
    handler5: MethodRouteHandler<THttpMethod, TParams, TQuery, TV5, TR5>,
    handler6: MethodRouteHandler<THttpMethod, TParams, TQuery, TV6, TR6>,
  ): MethodRouteMapping<
    THttpMethod,
    TParams,
    TR1 | TR2 | TR3 | TR4 | TR5 | TR6,
    TV6,
    TOnErrorResponse
  >;
}
