import type { NextResponse } from "next/server";
import type {
  CATCH_ALL_PREFIX,
  DYNAMIC_PREFIX,
  HTTP_METHOD_FUNC_KEYS,
  OPTIONAL_CATCH_ALL_PREFIX,
} from "rpc4next-shared";

import type { ContentType } from "../lib/content-type-types";
import type { HttpRequestHeaders } from "../lib/http-request-headers-types";
import type { HttpStatusCode } from "../lib/http-status-code-types";
import type { JsonParsed } from "../lib/json-types";
import type { RpcErrorCode, RpcErrorStatus } from "../server/error";
import type { procedureDefinitionSymbol } from "../server/procedure-definition";
import type {
  ProcedureInputContract,
  ProcedureValidationErrorResponseMap,
  WithProcedureDefinition,
} from "../server/procedure-types";
import type { RouteHandlerResponse, RouteResponse, ValidationSchema } from "../server/route-types";
import type { TypedNextResponse, ValidationInputFor } from "../server/types";

type DistributeOmit<T, K extends PropertyKey> = T extends unknown ? Omit<T, K> : never;

/** Extension of the standard `RequestInit` interface with strongly typed headers. */
export type TypedRequestInit<TWithoutHeaders extends keyof HttpRequestHeaders = never> = Omit<
  RequestInit,
  "headers"
> &
  (
    | {
        headers?: Omit<HttpRequestHeaders, TWithoutHeaders> & Record<string, string>;
        headersInit?: never;
      }
    | {
        headers?: never;
        headersInit?: HeadersInit;
      }
  );

/**
 * Options shared by generated RPC method calls.
 *
 * Provide `fetch` to route requests through a custom transport in tests or server runtimes. Provide
 * `init` for default `fetch` options applied to each call unless overridden by a method call.
 */
export type RpcClientOptions<
  TWithoutHeaders extends "Content-Type" | "Cookie" = never,
  TWithoutInit extends "body" | "headers" | "headersInit" = never,
> = {
  fetch?: typeof fetch;
  init?: DistributeOmit<TypedRequestInit<TWithoutHeaders>, TWithoutInit>;
};

/** Client-wide transport options, including the source of request cookies. */
export type RpcClientCreationOptions = RpcClientOptions & {
  /**
   * Cookie handling for this client. Defaults to `"managed"`, which leaves cookies to fetch or its
   * transport and removes cookie values from typed method arguments. `"explicit"` accepts cookie
   * arguments and serializes them on the server; requests in browsers and browser workers throw.
   * Managed mode rejects cookie arguments at runtime and does not set or forward cookies.
   */
  cookieMode?: "explicit" | "managed";
};

declare const __proxy: unique symbol;
/** Marker used by generated `PathStructure` leaves that represent callable endpoints. */
export type RpcEndpoint = { [__proxy]?: true };

export declare const rpc4nextGeneratedSchemaSymbol: unique symbol;
/** Schema version emitted by `rpc4next-cli` and checked by the runtime client types. */
export type RpcGeneratedSchemaVersion = 2;
/** Root type emitted by `rpc4next-cli` and passed to `createRpcClient<PathStructure>(...)`. */
export type RpcGeneratedPathStructure<
  TPathStructure extends object = object,
  TSchemaVersion extends RpcGeneratedSchemaVersion = RpcGeneratedSchemaVersion,
> = TPathStructure & {
  readonly [rpc4nextGeneratedSchemaSymbol]: TSchemaVersion;
};
type RpcGeneratedSchemaKey = typeof rpc4nextGeneratedSchemaSymbol;

export declare const rpc4nextPageRouteSymbol: unique symbol;
type RpcPageRouteKey = typeof rpc4nextPageRouteSymbol;

/** Internal generated key carrying dynamic route parameter types. */
export type ParamsKey = "__params";
type HasParamsMarker = Record<ParamsKey, unknown>;
/** Internal generated key carrying route or page query parameter types. */
export type QueryKey = "__query";
type HasQueryMarker = Record<QueryKey, unknown>;

export type HttpMethodFuncKey = (typeof HTTP_METHOD_FUNC_KEYS)[number];
type HttpMethodMapLike = {
  [K in HttpMethodFuncKey]?: unknown;
};

type OptionalCatchAllKey = `${typeof OPTIONAL_CATCH_ALL_PREFIX}${string}`;
type CatchAllKey = `${typeof CATCH_ALL_PREFIX}${string}`;
type DynamicKey = `${typeof DYNAMIC_PREFIX}${string}`;

/** Values accepted by generated dynamic path segment functions. */
export type PathParamsInput<T = Record<string, string | number | string[] | undefined>> = T;

type ExtractParams<T = unknown> = T extends HasParamsMarker ? T[ParamsKey] : Record<string, string>;

/** Options accepted by generated `$url(...)` helpers. */
export type UrlOptions<T = unknown, TQuery = unknown> = T extends HasQueryMarker
  ? AllOptional<T[QueryKey]> extends true
    ? { query?: T[QueryKey]; hash?: string }
    : { query: T[QueryKey]; hash?: string }
  : IsNever<TQuery> extends true
    ? { hash?: string }
    : AllOptional<TQuery> extends true
      ? { query?: TQuery; hash?: string }
      : { query: TQuery; hash?: string };

/** Result returned by generated `$url()` helpers for pages and endpoints. */
export type UrlResult<T = unknown> = {
  pathname: string;
  path: string;
  relativePath: string;
  /** Unencoded route parameters. Numeric single-segment inputs are returned as strings. */
  params: ExtractParams<T>;
};

type IsNever<T> = [T] extends [never] ? true : false;
type AllOptional<T> = Partial<T> extends T ? true : false;
type AwaitedProps<T> = Awaited<T>;

type UrlArgs<T, TQuery, TUrlOptions = UrlOptions<T, TQuery>> =
  AllOptional<TUrlOptions> extends true ? [url?: TUrlOptions] : [url: TUrlOptions];
type UrlArgsObj<T, TQuery, TUrlOptions = UrlOptions<T, TQuery>> =
  AllOptional<TUrlOptions> extends true ? { url?: TUrlOptions } : { url: TUrlOptions };

/** JSON body wrapper accepted by generated mutating RPC methods. */
export type JsonBodyOptions<TJson = unknown> = { json: TJson };
/** FormData body wrapper accepted by generated mutating RPC methods. */
export type FormDataBodyOptions = { formData: FormData };
type BodyArgsObj<TJson, TFormData> =
  IsNever<TJson> extends true
    ? IsNever<TFormData> extends true
      ? unknown
      : { body: FormDataBodyOptions }
    : { body: JsonBodyOptions<TJson> };

/** Typed request headers and cookies accepted by generated RPC methods. */
export type RequestHeadersOptions<THeaders = unknown, TCookies = unknown> = {
  headers: THeaders;
  cookies: TCookies;
};
type RequestHeadersArgs<THeaders = unknown, TCookies = unknown> =
  IsNever<THeaders> extends true
    ? Pick<RequestHeadersOptions<THeaders, TCookies>, "cookies">
    : IsNever<TCookies> extends true
      ? Pick<RequestHeadersOptions<THeaders, TCookies>, "headers">
      : RequestHeadersOptions<THeaders, TCookies>;
type HeadersArgsObj<THeaders = unknown, TCookies = unknown> =
  IsNever<THeaders> extends true
    ? IsNever<TCookies> extends true
      ? unknown
      : { requestHeaders: RequestHeadersArgs<THeaders, TCookies> }
    : { requestHeaders: RequestHeadersArgs<THeaders, TCookies> };

type MethodInitExclusions<TJson, TFormData, TCookies> =
  | (IsNever<TJson> extends true
      ? IsNever<TFormData> extends true
        ? never
        : "Content-Type"
      : "Content-Type")
  | (IsNever<TCookies> extends true ? never : "Cookie");
type MethodOptionExclusions<TJson, TFormData, THeaders> =
  | (IsNever<TJson> extends true ? (IsNever<TFormData> extends true ? never : "body") : "body")
  | (IsNever<THeaders> extends true ? never : "headers" | "headersInit");

type HttpMethodsArgs<
  TMethod extends HttpMethodFuncKey,
  T,
  TValidationSchema extends ValidationSchema,
  TCookieMode extends "explicit" | "managed" = "managed",
  TQuery = ValidationInputFor<"query", TValidationSchema>,
  TJson = TMethod extends "$get" | "$head" ? never : ValidationInputFor<"json", TValidationSchema>,
  TFormData = TMethod extends "$get" | "$head"
    ? never
    : ValidationInputFor<"formData", TValidationSchema>,
  THeaders = ValidationInputFor<"headers", TValidationSchema>,
  TCookies = TCookieMode extends "managed"
    ? never
    : ValidationInputFor<"cookies", TValidationSchema>,
  TBaseArgs = UrlArgsObj<T, TQuery> &
    BodyArgsObj<TJson, TFormData> &
    HeadersArgsObj<THeaders, TCookies>,
> = [
  ...(AllOptional<TBaseArgs> extends true ? [methodParam?: TBaseArgs] : [methodParam: TBaseArgs]),
  option?: RpcClientOptions<
    MethodInitExclusions<TJson, TFormData, TCookies>,
    MethodOptionExclusions<TJson, TFormData, THeaders>
  >,
];

type InferHttpMethods<T extends HttpMethodMapLike, TCookieMode extends "explicit" | "managed"> = {
  [K in keyof T as K extends HttpMethodFuncKey ? K : never]: (
    ...args: HttpMethodsArgs<
      Extract<K, HttpMethodFuncKey>,
      T,
      InferValidationSchema<T[K]>,
      TCookieMode
    >
  ) => Promise<InferTypedNextResponseType<T[K]>>;
};

type InferHttpMethodValidationSchema<T> = {
  [K in keyof T]: K extends HttpMethodFuncKey ? InferValidationSchema<T[K]> : never;
}[keyof T & HttpMethodFuncKey];

type ExtractAttachedProcedureDefinition<T> = typeof procedureDefinitionSymbol extends keyof T
  ? T extends WithProcedureDefinition<unknown, infer TDefinition>
    ? TDefinition
    : never
  : never;

type InferValidationSchema<T> =
  ExtractAttachedProcedureDefinition<T> extends {
    input: ProcedureInputContract<infer TValidationSchema>;
  }
    ? TValidationSchema
    : T extends (...args: never[]) => RouteHandlerResponse<RouteResponse, infer TValidationSchema>
      ? TValidationSchema
      : ValidationSchema;

type InferNextResponseType<TResponse> = TResponse extends NextResponse<infer U> ? U : unknown;

type ProcedureErrorResponse<TCode extends RpcErrorCode = RpcErrorCode> = TCode extends RpcErrorCode
  ? TypedNextResponse<
      {
        error: {
          code: TCode;
          message: string;
        };
      },
      RpcErrorStatus<TCode>,
      "application/json"
    >
  : never;

type ResolveStatus<TStatus, TDefault extends HttpStatusCode> = TStatus extends HttpStatusCode
  ? TStatus
  : TDefault;

type InferProcedureValidationErrorResponse<T> =
  IsNever<ExtractAttachedProcedureDefinition<T>> extends true
    ? never
    : ExtractAttachedProcedureDefinition<T> extends {
          input: ProcedureInputContract<infer TValidationSchema, infer TValidationErrorResponses>;
        }
      ? keyof TValidationSchema["input"] extends never
        ? never
        : | ProcedureErrorResponse<"BAD_REQUEST">
          | InferProcedureCustomValidationErrorResponse<TValidationErrorResponses>
      : never;

type InferProcedureCustomValidationErrorResponse<TValidationErrorResponses> =
  TValidationErrorResponses extends ProcedureValidationErrorResponseMap
    ? NormalizeProcedureValidationErrorResponse<
        Exclude<TValidationErrorResponses[keyof TValidationErrorResponses], undefined>
      >
    : never;

type NormalizeProcedureValidationErrorResponse<TResult> = TResult extends TypedNextResponse
  ? TResult
  : TResult extends NextResponse<infer TData>
    ? TypedNextResponse<JsonParsed<TData>, HttpStatusCode, ContentType>
    : TResult extends Response
      ? TypedNextResponse<unknown, HttpStatusCode, ContentType>
      : TResult extends {
            redirect: string;
            status?: infer TStatus;
          }
        ? TypedNextResponse<undefined, ResolveStatus<TStatus, 307>, "">
        : TResult extends {
              body: infer TBody;
              status?: infer TStatus;
            }
          ? TBody extends string
            ? TypedNextResponse<TBody, ResolveStatus<TStatus, 200>, "text/plain">
            : TypedNextResponse<JsonParsed<TBody>, ResolveStatus<TStatus, 200>, "application/json">
          : TResult extends {
                status?: infer TStatus;
              }
            ? TypedNextResponse<undefined, ResolveStatus<TStatus, 200>, ContentType>
            : never;

type InferProcedureOutputValidationErrorResponse<T> =
  IsNever<ExtractAttachedProcedureDefinition<T>> extends true
    ? never
    : ExtractAttachedProcedureDefinition<T> extends {
          output: {
            runtime: true;
          };
        }
      ? ProcedureErrorResponse<"INTERNAL_SERVER_ERROR">
      : never;

type InferTypedNextResponseTypeFromResponse<TResponse> = TResponse extends TypedNextResponse
  ? TResponse
  : TypedNextResponse<JsonParsed<InferNextResponseType<TResponse>>, HttpStatusCode, ContentType>;

type InferTypedNextResponseType<T> = T extends (...args: never[]) => unknown
  ? | InferTypedNextResponseTypeFromResponse<Awaited<ReturnType<T>>>
    | InferProcedureValidationErrorResponse<T>
    | InferProcedureOutputValidationErrorResponse<T>
  : TypedNextResponse<never, HttpStatusCode, ContentType>;

type PathProxyAsProperty<T> = {
  $match: (path: string) =>
    | ({
        params: ExtractParams<T>;
      } & Partial<UrlOptions<T, InferQuery<T>>>)
    | null;
};

type InferQuery<T> =
  InferHttpMethodValidationSchema<T> extends infer TValidationSchema
    ? TValidationSchema extends ValidationSchema
      ? ValidationInputFor<"query", TValidationSchema>
      : never
    : never;

/** Infers the query input declared by a procedure-backed route or page. */
export type ProcedureQueryInput<T> =
  ExtractAttachedProcedureDefinition<T> extends {
    input: ProcedureInputContract<infer TValidationSchema>;
  }
    ? ValidationInputFor<"query", TValidationSchema>
    : never;

type PagePropsQueryInput<TPage> = TPage extends (props: infer TProps, ...args: never[]) => unknown
  ? TProps extends { searchParams?: infer TSearchParams }
    ? AwaitedProps<TSearchParams>
    : never
  : never;

/** Infers a page's query shape from its procedure contract or native page props. */
export type InferPageQuery<TPage> =
  IsNever<ProcedureQueryInput<TPage>> extends true
    ? PagePropsQueryInput<TPage>
    : ProcedureQueryInput<TPage>;

/** Alias for `InferPageQuery` for generated page `$url({ query })` call sites. */
export type PageQueryInput<TPage> = InferPageQuery<TPage>;

/** Marker attached to generated page path entries so `$url()` can infer page query types. */
export type PageRouteMarker<TPage> = { readonly [rpc4nextPageRouteSymbol]: TPage } & (IsNever<
  InferPageQuery<TPage>
> extends true
  ? unknown
  : Record<QueryKey, InferPageQuery<TPage>>);

/** Infers the return type produced by `createRpcTestPageClient(...).$render()`. */
export type InferPageRenderResult<T> =
  T extends Record<RpcPageRouteKey, infer TPage>
    ? TPage extends (...args: never[]) => infer TResult
      ? Awaited<TResult>
      : unknown
    : unknown;

type PathProxyAsFunction<T, TCookieMode extends "explicit" | "managed"> = {
  $url: (...args: UrlArgs<T, InferQuery<T>>) => UrlResult<T>;
} & (T extends HttpMethodMapLike ? InferHttpMethods<T, TCookieMode> : unknown);

/**
 * Applies a route parameter. Empty strings, `.` and `..` are rejected during URL construction,
 * including individual catch-all elements. An optional catch-all may be omitted or be an empty
 * array.
 */
type ParamFunction<T, TParamArgs extends unknown[], TCookieMode extends "explicit" | "managed"> = (
  ...args: TParamArgs
) => DynamicPathProxyAsFunction<T, TCookieMode>;

type NonEmptyArray<T> = [T, ...T[]];

/** Generated client proxy shape where dynamic segments are called as functions. */
export type DynamicPathProxyAsFunction<
  T,
  TCookieMode extends "explicit" | "managed" = "managed",
> = Omit<
  (T extends RpcEndpoint ? PathProxyAsFunction<T, TCookieMode> : unknown) & {
    [K in keyof T]: K extends OptionalCatchAllKey
      ? ParamFunction<T[K], [value?: string[]], TCookieMode>
      : K extends CatchAllKey
        ? ParamFunction<T[K], [value: NonEmptyArray<string>], TCookieMode>
        : K extends DynamicKey
          ? ParamFunction<T[K], [value: string | number], TCookieMode>
          : DynamicPathProxyAsFunction<T[K], TCookieMode>;
  },
  QueryKey | ParamsKey | RpcGeneratedSchemaKey | RpcPageRouteKey
>;

/** Generated helper proxy shape where route segments stay as properties for `$match()`. */
export type DynamicPathProxyAsProperty<T> = Omit<
  (T extends RpcEndpoint ? PathProxyAsProperty<T> : unknown) & {
    [K in keyof T]: K extends unknown
      ? DynamicPathProxyAsProperty<T[K]>
      : DynamicPathProxyAsProperty<T[K]>;
  },
  QueryKey | ParamsKey | RpcGeneratedSchemaKey | RpcPageRouteKey
>;

/** Low-level extension point used by rpc4next proxy factories. */
export type RpcProxyHandler = (
  key: string,
  context: {
    paths: string[];
    params: PathParamsInput;
    dynamicKeys: string[];
    options: RpcClientCreationOptions;
  },
) => unknown;
