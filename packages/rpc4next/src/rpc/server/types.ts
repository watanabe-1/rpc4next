import type { NextRequest, NextResponse } from "next/server";
import type { HttpMethod } from "rpc4next-shared";

import type { ContentType } from "../lib/content-type-types";
import type { HttpResponseHeaders } from "../lib/http-response-headers-types";
import type {
  HttpStatusCode,
  RedirectionHttpStatusCode,
  SuccessfulHttpStatusCode,
} from "../lib/http-status-code-types";
import type {
  DefaultRpcErrorCatalog,
  RpcErrorCatalog,
  RpcErrorCode,
  RpcErrorEnvelope,
  RpcErrorResponseInit,
  RpcErrorStatus,
} from "./error";
import type { ValidationSchema } from "./route-types";

/**
 * Represents the result of an HTTP response status check.
 *
 * If the status code is in the range of successful HTTP status codes (e.g., 200–299), `ok` is
 * `true` and `status` is set to the given successful status code.
 *
 * Otherwise, `ok` is `false` and `status` is set to a non-successful status code (i.e., `T`
 * excluding successful status codes).
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
 * Extension of the standard `ResponseInit` interface with strongly typed status and headers.
 *
 * @template TStatus - The HTTP status code.
 * @template TContentType - The content type of the response.
 */
export type TypedResponseInit<TStatus extends HttpStatusCode, TContentType extends ContentType> =
  | ({
      headers?: HttpResponseHeaders<TContentType> & Record<string, string>;
      headersInit?: never;
    } & Omit<ResponseInit, "headers">)
  | (({
      headers?: never;
      headersInit?: HeadersInit;
    } & Omit<ResponseInit, "headers">) & {
      status?: TStatus;
    });

/**
 * A strongly typed wrapper around the standard Next.js `NextResponse` object, with additional type
 * information for status code, content type, and response body.
 *
 * @template TData - The type of the response body (e.g., a JSON object or string).
 * @template TStatus - The HTTP status code type of the response.
 * @template TContentType - The content type of the response (e.g., "application/json" or
 *   "text/plain").
 */
export interface TypedNextResponse<
  TData = unknown,
  TStatus extends HttpStatusCode = HttpStatusCode,
  TContentType extends ContentType = ContentType,
> extends NextResponse {
  /**
   * Returns the parsed response body as JSON, if the content type is "application/json". Otherwise,
   * returns a `Promise<never>`.
   */
  json: TContentType extends "application/json" ? () => Promise<TData> : () => Promise<never>;

  /**
   * Returns the response body as plain text, if the content type is "text/plain". If the expected
   * type `T` is not a string, returns `Promise<never>`. Otherwise, returns the raw string body.
   */
  text: TContentType extends "text/plain"
    ? TData extends string
      ? () => Promise<TData>
      : () => Promise<never>
    : () => Promise<string>;

  /** Indicates whether the HTTP status code represents a successful response. */
  readonly ok: HttpStatus<TStatus>["ok"];

  /** The HTTP status code of the response, typed based on the given `TStatus`. */
  readonly status: HttpStatus<TStatus>["status"];
}

/** Typed `response.json(...)` helper exposed to procedure handlers. */
export type JsonResponseHelper<TJson = unknown> = [unknown] extends [TJson]
  ? <TData, TStatus extends HttpStatusCode = 200>(
      data: TData,
      init?: TStatus | TypedResponseInit<TStatus, "application/json">,
    ) => TypedNextResponse<TData, TStatus, "application/json">
  : <TStatus extends HttpStatusCode = 200>(
      data: TJson,
      init?: TStatus | TypedResponseInit<TStatus, "application/json">,
    ) => TypedNextResponse<TJson, TStatus, "application/json">;

/** Response helpers that preserve payload, status, and content-type in generated client types. */
export interface ResponseHelpers<
  TJson = unknown,
  TErrorCatalog extends RpcErrorCatalog = DefaultRpcErrorCatalog,
> {
  /** Creates a typed arbitrary body response. */
  body: <
    TData extends BodyInit | null,
    TContentType extends ContentType,
    TStatus extends HttpStatusCode = 200,
  >(
    data: TData,
    init?: TStatus | TypedResponseInit<TStatus, TContentType>,
  ) => TypedNextResponse<TData, TStatus, TContentType>;

  /** Creates a typed JSON response. */
  json: JsonResponseHelper<TJson>;

  /** Creates a typed plain-text response. */
  text: <TData extends string, TStatus extends HttpStatusCode = 200>(
    data: TData,
    init?: TStatus | TypedResponseInit<TStatus, "text/plain">,
  ) => TypedNextResponse<TData, TStatus, "text/plain">;

  /**
   * Passed through to NextResponse.redirect. Validate user-controlled values before passing
   * absolute URLs here; use relative URLs when redirecting inside the same app.
   */
  redirect: <TStatus extends RedirectionHttpStatusCode = 307>(
    url: string,
    init?: TStatus | TypedResponseInit<TStatus, "">,
  ) => TypedNextResponse<undefined, TStatus, "">;

  /** Creates a typed rpc4next error envelope response from the configured error catalog. */
  error: <TCode extends RpcErrorCode<TErrorCatalog>, TDetails = unknown>(
    code: TCode,
    init?: RpcErrorResponseInit<TDetails>,
  ) => TypedNextResponse<
    RpcErrorEnvelope<TCode, TDetails>,
    RpcErrorStatus<TCode, TErrorCatalog>,
    "application/json"
  >;
}

/** Normalized dynamic route params used by procedure handlers. */
export type Params = Record<string, string | string[]>;

/** Normalized query params used by procedure handlers. */
export type Query = Record<string, string | string[]>;

/** Legacy route context shape used by lower-level adapters. */
export interface RouteContext<
  TParams = Params,
  TQuery = Query,
  _TValidationSchema extends ValidationSchema = ValidationSchema,
> extends ResponseHelpers {
  /**
   * The original `NextRequest` object, extended with helper methods for parsing parameters, query,
   * and managing validation.
   */
  req: NextRequest & {
    /**
     * Parses and returns typed query parameters from `req.nextUrl.searchParams`.
     *
     * @returns Query parameters
     */
    query: () => TQuery;

    /**
     * Resolves and returns dynamic route parameters. Typically sourced from the Next.js segment
     * config.
     *
     * @returns Route parameters
     */
    params: () => Promise<TParams>;
  };
}

type ValidationTargetKey = "params" | "query" | "json" | "formData" | "headers" | "cookies";

/** Input targets available for a procedure, narrowed by HTTP method where needed. */
export type ValidationTarget<THttpMethod extends HttpMethod = HttpMethod> = THttpMethod extends
  | "GET"
  | "HEAD"
  ? Exclude<ValidationTargetKey, "json" | "formData">
  : ValidationTargetKey;

type ValidationFor<
  TDirection extends keyof ValidationSchema,
  TTarget extends ValidationTarget,
  TSchema extends ValidationSchema,
> = TTarget extends keyof TSchema[TDirection] ? TSchema[TDirection][TTarget] : never;

/** Infers the raw input type expected by one validation target in a schema map. */
export type ValidationInputFor<
  TTarget extends ValidationTarget,
  TSchema extends ValidationSchema,
> = ValidationFor<"input", TTarget, TSchema>;

/** Selects a validation input type only when the current target matches the expected target. */
export type ConditionalValidationInput<
  TTarget extends ValidationTarget,
  TExpected extends ValidationTarget,
  TSchema extends ValidationSchema,
  TFallback,
> = TTarget extends TExpected ? ValidationInputFor<TTarget, TSchema> : TFallback;
