import type { ValidationSchema } from "./route-types";
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
 * Extension of the standard `ResponseInit` interface with strongly typed status and headers.
 *
 * @template TStatus - The HTTP status code.
 * @template TContentType - The content type of the response.
 */
export interface TypedResponseInit<
  TStatus extends HttpStatusCode,
  TContentType extends ContentType,
> extends ResponseInit {
  headers?: HttpResponseHeaders<TContentType> | HeadersInit;
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
    init?: TStatus | TypedResponseInit<TStatus, "">
  ) => TypedNextResponse<undefined, TStatus, "">;
}

export type ValidationTarget = "params" | "query" | "json";

type ValidationFor<
  TDirection extends keyof ValidationSchema,
  TTarget extends ValidationTarget,
  TSchema extends ValidationSchema,
> = TTarget extends keyof TSchema[TDirection]
  ? TSchema[TDirection][TTarget]
  : never;

export type ValidationInputFor<
  TTarget extends ValidationTarget,
  TSchema extends ValidationSchema,
> = ValidationFor<"input", TTarget, TSchema>;

type ValidationOutputFor<
  TTarget extends ValidationTarget,
  TSchema extends ValidationSchema,
> = ValidationFor<"output", TTarget, TSchema>;

export type ConditionalValidationInput<
  TTarget extends ValidationTarget,
  TExpected extends ValidationTarget,
  TSchema extends ValidationSchema,
  TFallback,
> = TTarget extends TExpected
  ? ValidationInputFor<TTarget, TSchema>
  : TFallback;
