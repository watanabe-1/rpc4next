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

/**
 * A content type that can be either one of the predefined `KnownContentType` values,
 * or any other custom string.
 */
// Allow KnownContentType values with autocomplete, plus any custom string.
// (string & {}) keeps literal types while accepting arbitrary strings.
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

/**
 * Represents the result of an HTTP response status check.
 *
 * If the status code is in the range of successful HTTP status codes (e.g., 200–299),
 * `ok` is `true` and `status` is set to the given successful status code.
 *
 * Otherwise, `ok` is `false` and `status` is set to a non-successful status code
 * (i.e., `T` excluding successful status codes).
 *
 * @template T - An HTTP status code to classify.
 */
type HttpStatus<T extends HttpStatusCode> = T extends SuccessfulHttpStatusCode
  ? { ok: true; status: T }
  : {
      ok: false;
      status: Exclude<T, SuccessfulHttpStatusCode>;
    };

/**
 * A strongly typed wrapper around the standard Next.js `NextResponse` object,
 * with additional type information for status code, content type, and response body.
 *
 * @template TData - The type of the response body (e.g., a JSON object or string).
 * @template TStatus - The HTTP status code type of the response.
 * @template TContentType - The content type of the response (e.g., "application/json" or "text/plain").
 */
export interface TypedNextResponse<
  TData = unknown,
  TStatus extends HttpStatusCode = HttpStatusCode,
  TContentType extends ContentType = ContentType,
> extends NextResponse {
  /**
   * Returns the parsed response body as JSON, if the content type is "application/json".
   * Otherwise, returns a `Promise<never>`.
   */
  json: TContentType extends "application/json"
    ? () => Promise<TData>
    : () => Promise<never>;

  /**
   * Returns the response body as plain text, if the content type is "text/plain".
   * If the expected type `T` is not a string, returns `Promise<never>`.
   * Otherwise, returns the raw string body.
   */
  text: TContentType extends "text/plain"
    ? TData extends string
      ? () => Promise<TData>
      : () => Promise<never>
    : () => Promise<string>;

  /**
   * Indicates whether the HTTP status code represents a successful response.
   */
  readonly ok: HttpStatus<TStatus>["ok"];

  /**
   * The HTTP status code of the response, typed based on the given `TStatus`.
   */
  readonly status: HttpStatus<TStatus>["status"];
}

export type Params = Record<string, string | string[]>;

export type Query = Record<string, string | string[]>;

/**
 * A typed wrapper around Next.js request/response utilities for API route handling.
 *
 * ## Features:
 * - Enhanced `req` with helpers to parse query parameters, route params, and perform schema validation.
 * - Typed response helpers (`json`, `text`, `body`) that return custom `TypedNextResponse` objects.
 *
 * @template TParams - Shape of dynamic route parameters.
 * @template TQuery - Shape of parsed URL query parameters.
 * @template TValidationSchema - Validation schema used to validate body/query/params.
 */
export interface RouteContext<
  TParams = Params,
  TQuery = Query,
  TValidationSchema extends ValidationSchema = ValidationSchema,
> {
  /**
   * The original `NextRequest` object, extended with helper methods
   * for parsing parameters, query, and managing validation.
   */
  req: NextRequest & {
    /**
     * Parses and returns typed query parameters from `req.nextUrl.searchParams`.
     *
     * @returns Query parameters
     */
    query: () => TQuery;

    /**
     * Resolves and returns dynamic route parameters.
     * Typically sourced from the Next.js segment config.
     *
     * @returns Route parameters
     */
    params: () => Promise<TParams>;

    /**
     * Retrieves validated data for a specific request part (e.g., `body`, `query`, `params`)
     * that has been previously stored via `addValidatedData`.
     *
     * @param target - The part of the request to validate.
     * @returns The validation result of the target.
     */
    valid: <TValidationTarget extends ValidationTarget>(
      target: TValidationTarget
    ) => ValidationOutputFor<TValidationTarget, TValidationSchema>;

    /**
     * Stores validated data for a specific part of the request.
     * This data can be retrieved later using `valid(...)`.
     *
     * @param target - The request part to associate the value with.
     * @param value - The validated data.
     */
    addValidatedData: (target: ValidationTarget, value: object) => void;
  };

  /**
   * Creates a typed response with an optional status and content type.
   * Internally wraps `new NextResponse(...)`.
   *
   * @param data - The response body.
   * @param init - Optional status code and content type.
   * @returns A typed response.
   */
  body: <
    TData extends BodyInit | null,
    TStatus extends HttpStatusCode,
    TContentType extends ContentType,
  >(
    data: TData,
    init?: ResponseInit & { status?: TStatus; contentType?: TContentType }
  ) => TypedNextResponse<TData, TStatus, TContentType>;

  /**
   * Creates a typed JSON response using `NextResponse.json(...)`.
   *
   * @param data - The response body as JSON.
   * @param init - Optional status code.
   * @returns A JSON response.
   */
  json: <TData, TStatus extends HttpStatusCode = 200>(
    data: TData,
    init?: ResponseInit & { status?: TStatus }
  ) => TypedNextResponse<TData, TStatus, "application/json">;

  /**
   * Creates a plain text response with `Content-Type: text/plain`.
   * Internally uses `new NextResponse(...)` with headers.
   *
   * @param data - The response body as plain text.
   * @param init - Optional status code.
   * @returns A plain text response.
   */
  text: <TData extends string, TStatus extends HttpStatusCode = 200>(
    data: TData,
    init?: ResponseInit & { status?: TStatus }
  ) => TypedNextResponse<TData, TStatus, "text/plain">;

  /**
   * Returns a `404 Not Found` response.
   * Internally wraps Next.js's `notFound()` utility.
   */
  notFound: () => TypedNextResponse<null, 404, "text/html">;

  /**
   * Issues a redirect response.
   * Internally wraps `NextResponse.redirect(...)`.
   *
   * @param url - The URL to redirect to.
   * @param status - Optional redirect status code (default: 302).
   * @returns A redirect response with content type `text/html`.
   */
  redirect: <TStatus extends HttpStatusCode = 302>(
    url: string,
    status?: TStatus
  ) => TypedNextResponse<null, TStatus, "text/html">;
}

export type RouteResponse =
  | TypedNextResponse
  | Promise<TypedNextResponse | void>;

export interface RouteBindings {
  params?: Params | Promise<Params>;
  query?: Query;
}

export type ValidationTarget = "params" | "query";

export interface ValidationSchema {
  // eslint-disable-next-line @typescript-eslint/no-empty-object-type
  input: {};
  // eslint-disable-next-line @typescript-eslint/no-empty-object-type
  output: {};
}

type ValidationFor<
  TDirection extends keyof ValidationSchema,
  TTarget extends ValidationTarget,
  TSchema extends ValidationSchema,
> = TTarget extends keyof TSchema[TDirection]
  ? TSchema[TDirection][TTarget]
  : never;

type ValidationInputFor<
  TTarget extends ValidationTarget,
  TSchema extends ValidationSchema,
> = ValidationFor<"input", TTarget, TSchema>;

type ValidationOutputFor<
  TTarget extends ValidationTarget,
  TSchema extends ValidationSchema,
> = ValidationFor<"output", TTarget, TSchema>;

type ArrayElementsToString<T> = T extends unknown[] ? string[] : string;

type ObjectPropertiesToString<T> = {
  [K in keyof T]: T[K] extends unknown[] ? ArrayElementsToString<T[K]> : string;
};

export type ConditionalValidationInput<
  TTarget extends ValidationTarget,
  TExpected extends ValidationTarget,
  TSchema extends ValidationSchema,
  TFallback,
> = TTarget extends TExpected
  ? ObjectPropertiesToString<ValidationInputFor<TTarget, TSchema>>
  : TFallback;

export type Handler<
  TParams = Params,
  TQuery = Query,
  TValidationSchema extends ValidationSchema = ValidationSchema,
  TRouteResponse extends RouteResponse = RouteResponse,
> = (
  routeContext: RouteContext<TParams, TQuery, TValidationSchema>
) => TRouteResponse;

type RouteHandler<
  TParams extends RouteBindings["params"],
  TRouteResponse extends RouteResponse,
> = (
  req: NextRequest,
  segmentData: { params: Promise<TParams> }
) => Promise<Awaited<TRouteResponse>>;

type HttpMethodMapping<
  THttpMethod extends HTTP_METHOD,
  TParams extends RouteBindings["params"],
  TRouteResponse extends RouteResponse,
> = Record<THttpMethod, RouteHandler<TParams, TRouteResponse>>;

export interface MethodRouteDefinition<
  THttpMethod extends HTTP_METHOD,
  TBindings extends RouteBindings,
  TParams extends TBindings["params"] = TBindings extends {
    params: infer TValue;
  }
    ? Awaited<TValue>
    : Query,
  TQuery extends TBindings["query"] = TBindings extends { query: infer TValue }
    ? TValue
    : Query,
> {
  // 1 handler
  <
    TV1 extends ValidationSchema = ValidationSchema,
    TR1 extends RouteResponse = RouteResponse,
  >(
    handler: Handler<TParams, TQuery, TV1, TR1>
  ): HttpMethodMapping<THttpMethod, TParams, TR1>;

  // 2 handlers
  <
    TV1 extends ValidationSchema = ValidationSchema,
    TV2 extends ValidationSchema = TV1,
    TR1 extends RouteResponse = RouteResponse,
    TR2 extends RouteResponse = RouteResponse,
  >(
    handler1: Handler<TParams, TQuery, TV1, TR1>,
    handler2: Handler<TParams, TQuery, TV2, TR2>
  ): HttpMethodMapping<THttpMethod, TParams, TR1 | TR2>;

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
  ): HttpMethodMapping<THttpMethod, TParams, TR1 | TR2 | TR3>;
}
