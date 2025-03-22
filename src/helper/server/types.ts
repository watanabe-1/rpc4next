import type { HTTP_METHOD } from "next/dist/server/web/http";
import type { NextResponse, NextRequest } from "next/server";

type KnownContentType =
  | "application/json"
  | "text/html"
  | "text/plain"
  | "application/javascript"
  | "text/css"
  | "image/png"
  | "image/jpeg"
  | "image/svg+xml"
  | "application/pdf"
  | "application/octet-stream"
  | "multipart/form-data"
  | "application/x-www-form-urlencoded";

export type ContentType = KnownContentType | (string & {});

/**
 * Informational responses (100–199)
 */
type InformationalHttpStatusCode = 100 | 101 | 102 | 103;

/**
 * Successful responses (200–299)
 */
type SuccessfulHttpStatusCode =
  | 200
  | 201
  | 202
  | 203
  | 204
  | 205
  | 206
  | 207
  | 208
  | 226;

/**
 * Redirection messages (300–399)
 */
type RedirectionHttpStatusCode =
  | 300
  | 301
  | 302
  | 303
  | 304
  | 305
  | 306
  | 307
  | 308;

/**
 * Client error responses (400–499)
 */
type ClientErrorHttpStatusCode =
  | 400
  | 401
  | 402
  | 403
  | 404
  | 405
  | 406
  | 407
  | 408
  | 409
  | 410
  | 411
  | 412
  | 413
  | 414
  | 415
  | 416
  | 417
  | 418
  | 421
  | 422
  | 423
  | 424
  | 425
  | 426
  | 428
  | 429
  | 431
  | 451;

/**
 * Server error responses (500–599)
 */
type ServerErrorHttpStatusCode =
  | 500
  | 501
  | 502
  | 503
  | 504
  | 505
  | 506
  | 507
  | 508
  | 510
  | 511;

/**
 * Http status code (100～599)
 */
export type HttpStatusCode =
  | InformationalHttpStatusCode
  | SuccessfulHttpStatusCode
  | RedirectionHttpStatusCode
  | ClientErrorHttpStatusCode
  | ServerErrorHttpStatusCode;

type HttpStatus<T extends HttpStatusCode> = T extends SuccessfulHttpStatusCode
  ? { ok: true; status: T }
  : {
      ok: false;
      status: Exclude<T, SuccessfulHttpStatusCode>;
    };

export interface TypedNextResponse<
  T = unknown,
  TStatus extends HttpStatusCode = HttpStatusCode,
  TContentType extends ContentType = ContentType,
> extends NextResponse {
  json: TContentType extends "application/json"
    ? () => Promise<T>
    : () => Promise<never>;
  text: TContentType extends "text/plain"
    ? T extends string
      ? () => Promise<T>
      : () => Promise<never>
    : () => Promise<string>;

  readonly ok: HttpStatus<TStatus>["ok"];
  readonly status: HttpStatus<TStatus>["status"];
}

export type Params = Record<string, string | string[]>;
export type Query = Record<string, string | string[]>;

export type ValidationResults = {
  params?: Params;
  query?: Query;
};

export type ValidationTarget = keyof ValidationResults;

export interface RouteContext<
  TParams = Params,
  TQuery = Query,
  TValidationSchema extends ValidationSchema = ValidationSchema,
> {
  req: NextRequest & {
    query: () => TQuery;
    params: () => Promise<TParams>;
    valid: <TValidationTarget extends ValidationTarget>(
      target: TValidationTarget
    ) => ValidationOutputFor<TValidationTarget, TValidationSchema>;
    addValidatedData: (target: ValidationTarget, value: object) => void;
  };
  res: NextResponse;

  body: <
    TData extends BodyInit | null,
    TStatus extends HttpStatusCode,
    TContentType extends ContentType,
  >(
    data: TData,
    init?: ResponseInit & { status?: TStatus; contentType?: TContentType }
  ) => TypedNextResponse<TData, TStatus, TContentType>;

  json: <TData, TStatus extends HttpStatusCode = 200>(
    data: TData,
    init?: ResponseInit & { status?: TStatus }
  ) => TypedNextResponse<TData, TStatus, "application/json">;

  text: <TData extends string, TStatus extends HttpStatusCode = 200>(
    data: TData,
    init?: ResponseInit & { status?: TStatus }
  ) => TypedNextResponse<TData, TStatus, "text/plain">;

  notFound: () => TypedNextResponse<null, 404, "text/html">;

  redirect: <TStatus extends HttpStatusCode = 302>(
    url: string,
    status?: TStatus
  ) => TypedNextResponse<null, TStatus, "text/html">;
}

export type RouteResponse =
  | TypedNextResponse
  | Promise<TypedNextResponse | void>;

export type RouteBindings = {
  params?: Params | Promise<Params>;
  query?: Query;
};

export type ValidationSchema = {
  // eslint-disable-next-line @typescript-eslint/no-empty-object-type
  input: {};
  // eslint-disable-next-line @typescript-eslint/no-empty-object-type
  output: {};
};

export type ValidationOutputFor<
  TValidationTarget extends ValidationTarget,
  TValidationSchema extends ValidationSchema,
> = TValidationTarget extends keyof TValidationSchema["output"]
  ? TValidationSchema["output"][TValidationTarget]
  : never;

type ArrayElementsToString<T> = T extends unknown[] ? string[] : string;

type ObjectPropertiesToString<T> = {
  [K in keyof T]: T[K] extends unknown[] ? ArrayElementsToString<T[K]> : string;
};

export type ValidationOutputToString<
  TValidationTarget extends ValidationTarget,
  TValidationSchema extends ValidationSchema,
> = ObjectPropertiesToString<
  ValidationOutputFor<TValidationTarget, TValidationSchema>
>;

export type Handler<
  TParams = Params,
  TQuery = Query,
  TValidationSchema extends ValidationSchema = ValidationSchema,
  TRouteResponse extends RouteResponse = RouteResponse,
> = (
  routeContext: RouteContext<TParams, TQuery, TValidationSchema>
) => TRouteResponse;

type CreateRouteReturn<
  THttpMethod extends HTTP_METHOD,
  TParams extends RouteBindings["params"],
  TRouteResponse extends RouteResponse,
> = Record<
  THttpMethod,
  (
    req: NextRequest,
    segmentData: { params: Promise<TParams> }
  ) => Promise<Awaited<TRouteResponse>>
>;

export type CreateRoute<
  TBindings extends RouteBindings,
  THttpMethod extends HTTP_METHOD,
  TParams extends TBindings["params"] = TBindings extends {
    params: infer TValue;
  }
    ? Awaited<TValue>
    : Query,
  TQuery extends TBindings["query"] = TBindings extends { query: infer TValue }
    ? TValue
    : Query,
> = {
  // 1 handler
  <
    TV1 extends ValidationSchema = ValidationSchema,
    TR1 extends RouteResponse = RouteResponse,
  >(
    handler: Handler<TParams, TQuery, TV1, TR1>
  ): CreateRouteReturn<THttpMethod, TParams, TR1>;

  // 2 handlers
  <
    TV1 extends ValidationSchema = ValidationSchema,
    TV2 extends ValidationSchema = TV1,
    TR1 extends RouteResponse = RouteResponse,
    TR2 extends RouteResponse = RouteResponse,
  >(
    handler1: Handler<TParams, TQuery, TV1, TR1>,
    handler2: Handler<TParams, TQuery, TV2, TR2>
  ): CreateRouteReturn<THttpMethod, TParams, TR1 | TR2>;

  // 3 handlers
  <
    TV1 extends ValidationSchema = ValidationSchema,
    TV2 extends ValidationSchema = TV1,
    TV3 extends ValidationSchema = TV1 & TV2,
    TR1 extends RouteResponse = RouteResponse,
    TR2 extends RouteResponse = RouteResponse,
    TR3 extends RouteResponse = RouteResponse,
  >(
    handler1: Handler<TParams, TQuery, TV1, TR1>,
    handler2: Handler<TParams, TQuery, TV2, TR2>,
    handler3: Handler<TParams, TQuery, TV3, TR3>
  ): CreateRouteReturn<THttpMethod, TParams, TR1 | TR2 | TR3>;
};
