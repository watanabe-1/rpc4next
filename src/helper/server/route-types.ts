/*!
 * Portions of this code are based on the Hono project (https://github.com/honojs/hono),
 * originally created by Yusuke Wada (https://github.com/yusukebe) and developed with
 * contributions from the Hono community.
 * This code has been adapted and modified for this project.
 * Original copyright belongs to Yusuke Wada and the Hono project contributors.
 * Hono is licensed under the MIT License.
 */

import type { TypedNextResponse, Query, RouteContext, Params } from "./types";
import type { HttpMethod } from "../../lib/types";
import type { NextRequest } from "next/server";

export type RouteResponse =
  | TypedNextResponse
  | Promise<TypedNextResponse | void>;

export type RequiredRouteResponse =
  | TypedNextResponse
  | Promise<TypedNextResponse>;

export interface RouteBindings {
  params?: Params | Promise<Params>;
  query?: Query;
}

export interface ValidationSchema {
  // eslint-disable-next-line @typescript-eslint/no-empty-object-type
  input: {};
  // eslint-disable-next-line @typescript-eslint/no-empty-object-type
  output: {};
}

export type Handler<
  TParams = Params,
  TQuery = Query,
  TValidationSchema extends ValidationSchema = ValidationSchema,
  TRouteResponse extends RouteResponse = RouteResponse,
> = (
  routeContext: RouteContext<TParams, TQuery, TValidationSchema>
) => TRouteResponse;

export type ErrorHandler<
  TRouteResponse extends RequiredRouteResponse,
  TParams = Params,
  TQuery = Query,
  TValidationSchema extends ValidationSchema = ValidationSchema,
> = (
  error: unknown,
  routeContext: RouteContext<TParams, TQuery, TValidationSchema>
) => TRouteResponse;

type RouteHandler<
  TParams extends RouteBindings["params"],
  TRouteResponse extends RouteResponse,
> = (
  req: NextRequest,
  segmentData: { params: Promise<TParams> }
  // Exclude void | undefined because a response is always returned or an error is thrown internally
) => Promise<Exclude<Awaited<TRouteResponse>, void | undefined>>;

type HttpMethodMapping<
  THttpMethod extends HttpMethod,
  TParams extends RouteBindings["params"],
  TRouteResponse extends RouteResponse,
> = Record<THttpMethod, RouteHandler<TParams, TRouteResponse>>;

export interface MethodRouteDefinition<
  THttpMethod extends HttpMethod,
  TBindings extends RouteBindings,
  TOnErrorResponse extends RequiredRouteResponse,
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
    handler: Handler<TParams, TQuery, TV1, TR1>
  ): HttpMethodMapping<THttpMethod, TParams, TR1 | TOnErrorResponse>;

  // 2 handlers
  <
    TV1 extends ValidationSchema = ValidationSchema,
    TV2 extends ValidationSchema = TV1,
    TR1 extends RouteResponse = RouteResponse,
    TR2 extends RequiredRouteResponse = RequiredRouteResponse,
  >(
    handler1: Handler<TParams, TQuery, TV1, TR1>,
    handler2: Handler<TParams, TQuery, TV2, TR2>
  ): HttpMethodMapping<THttpMethod, TParams, TR1 | TR2 | TOnErrorResponse>;

  // 3 handlers
  <
    TV1 extends ValidationSchema = ValidationSchema,
    TV2 extends ValidationSchema = TV1,
    TV3 extends ValidationSchema = TV1 & TV2,
    TR1 extends RouteResponse = RouteResponse,
    TR2 extends RouteResponse = RouteResponse,
    TR3 extends RequiredRouteResponse = RequiredRouteResponse,
  >(
    handler1: Handler<TParams, TQuery, TV1, TR1>,
    handler2: Handler<TParams, TQuery, TV2, TR2>,
    handler3: Handler<TParams, TQuery, TV3, TR3>
  ): HttpMethodMapping<
    THttpMethod,
    TParams,
    TR1 | TR2 | TR3 | TOnErrorResponse
  >;
}
