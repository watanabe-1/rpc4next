import { error } from "console";
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
export type ContentType = KnownContentType | (string & {}) | undefined;

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
export type RedirectionHttpStatusCode =
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
 * Represents HTTP response headers with optional fields, parameterized by the content type.
 * This type includes common headers used for caching, content description, CORS, authentication, security, cookies, redirects, connection, and server information.
 *
 * @template TContentType - The specific content type for the `Content-Type` header.
 */
type HttpResponseHeaders<TContentType extends ContentType> = Partial<{
  // Cache control
  "Cache-Control": string;
  Expires: string;
  ETag: string;
  "Last-Modified": string;

  // Content information
  "Content-Type": TContentType;
  "Content-Length": string;
  "Content-Encoding": string;
  "Content-Language": string;
  "Content-Location": string;
  "Content-Disposition": string;

  // CORS (Cross-Origin Resource Sharing)
  "Access-Control-Allow-Origin": string;
  "Access-Control-Allow-Credentials": string;
  "Access-Control-Allow-Headers": string;
  "Access-Control-Allow-Methods": string;
  "Access-Control-Expose-Headers": string;

  // Authentication
  "WWW-Authenticate": string;
  Authorization: string;

  // Security
  "Strict-Transport-Security": string;
  "Content-Security-Policy": string;
  "X-Content-Type-Options": string;
  "X-Frame-Options": string;
  "X-XSS-Protection": string;
  "Referrer-Policy": string;
  "Permissions-Policy": string;
  "Cross-Origin-Opener-Policy": string;
  "Cross-Origin-Embedder-Policy": string;
  "Cross-Origin-Resource-Policy": string;

  // Cookies
  "Set-Cookie": string;

  // Redirect
  Location: string;

  // Connection and communication
  Connection: string;
  "Keep-Alive": string;
  "Transfer-Encoding": string;
  Upgrade: string;
  Vary: string;

  // Server information
  Date: string;
  Server: string;
  "X-Powered-By": string;
}>;

/**
 * Represents HTTP request headers with optional fields.
 * This type includes general request headers, CORS/security-related headers, and client-specific headers.
 */
type HttpRequestHeaders = Partial<{
  // General information
  Accept: string;
  "Accept-Charset": string;
  "Accept-Encoding": string;
  "Accept-Language": string;
  Authorization: string;
  "Cache-Control": string;
  Connection: string;
  "Content-Length": string;
  "Content-Type": string;
  Cookie: string;
  Date: string;
  Expect: string;
  Forwarded: string;
  From: string;
  Host: string;
  "If-Match": string;
  "If-Modified-Since": string;
  "If-None-Match": string;
  "If-Range": string;
  "If-Unmodified-Since": string;
  "Max-Forwards": string;
  Origin: string;
  Pragma: string;
  Range: string;
  Referer: string;
  TE: string;
  Trailer: string;
  "Transfer-Encoding": string;
  Upgrade: string;
  "User-Agent": string;
  Via: string;
  Warning: string;

  // CORS / Security-related
  "Access-Control-Request-Method": string;
  "Access-Control-Request-Headers": string;
  DNT: string; // Do Not Track
  "Sec-Fetch-Dest": string;
  "Sec-Fetch-Mode": string;
  "Sec-Fetch-Site": string;
  "Sec-Fetch-User": string;
  "Sec-CH-UA": string;
  "Sec-CH-UA-Platform": string;
  "Sec-CH-UA-Mobile": string;
}>;

/**
 * Extension of the standard `ResponseInit` interface with strongly typed status and headers.
 *
 * @template TStatus - The HTTP status code.
 * @template TContentType - The content type of the response.
 */
export interface TypedResponseInit<
  TStatus extends HttpStatusCode,
  TContentType extends ContentType,
> extends ResponseInit {
  headers?: HttpResponseHeaders<TContentType> & HeadersInit;
  status?: TStatus;
}

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
   * Creates a typed response with an optional status.
   * Internally wraps `new NextResponse(...)`.
   *
   * @param data - The response body.
   * @param init - Optional response init.
   * @returns A typed response.
   */
  body: <
    TData extends BodyInit | null,
    TContentType extends ContentType,
    TStatus extends HttpStatusCode = 200,
  >(
    data: TData,
    init?: TypedResponseInit<TStatus, TContentType>
  ) => TypedNextResponse<TData, TStatus, TContentType>;

  /**
   * Creates a typed JSON response using `NextResponse.json(...)`.
   *
   * @param data - The response body as JSON.
   * @param init - Optional response init.
   * @returns A JSON response.
   */
  json: <TData, TStatus extends HttpStatusCode = 200>(
    data: TData,
    init?: TypedResponseInit<TStatus, "application/json">
  ) => TypedNextResponse<TData, TStatus, "application/json">;

  /**
   * Creates a plain text response with `Content-Type: text/plain`.
   * Internally uses `new NextResponse(...)` with headers.
   *
   * @param data - The response body as plain text.
   * @param init - Optional response init.
   * @returns A plain text response.
   */
  text: <TData extends string, TStatus extends HttpStatusCode = 200>(
    data: TData,
    init?: TypedResponseInit<TStatus, "text/plain">
  ) => TypedNextResponse<TData, TStatus, "text/plain">;

  /**
   * Issues a redirect response.
   * Internally wraps `NextResponse.redirect(...)`.
   *
   * @param url - The URL to redirect to.
   * @param init - Optional redirect status code (default: 302).
   * @returns A redirect response.
   */
  redirect: <TStatus extends RedirectionHttpStatusCode = 302>(
    url: string,
    init?: TStatus | TypedResponseInit<TStatus, undefined>
  ) => TypedNextResponse<undefined, TStatus, undefined>;
}

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
  THttpMethod extends HTTP_METHOD,
  TParams extends RouteBindings["params"],
  TRouteResponse extends RouteResponse,
> = Record<THttpMethod, RouteHandler<TParams, TRouteResponse>>;

export interface MethodRouteDefinition<
  THttpMethod extends HTTP_METHOD,
  TBindings extends RouteBindings,
  TOnErrorResponse extends RequiredRouteResponse,
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
