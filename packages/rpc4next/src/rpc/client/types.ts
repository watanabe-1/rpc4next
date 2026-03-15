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
import type {
  RouteHandlerResponse,
  RouteResponse,
  ValidationSchema,
} from "../server/route-types";
import type { TypedNextResponse, ValidationInputFor } from "../server/types";

// biome-ignore lint/suspicious/noExplicitAny: intentional for existing type patterns
type DistributeOmit<T, K extends keyof any> = T extends any
  ? Omit<T, K>
  : never;

/**
 * Extension of the standard `RequestInit` interface with strongly typed headers.
 */
export type TypedRequestInit<
  TWithoutHeaders extends keyof HttpRequestHeaders = never,
> = Omit<RequestInit, "headers"> &
  (
    | {
        headers?: Omit<HttpRequestHeaders, TWithoutHeaders> &
          Record<string, string>;
        headersInit?: never;
      }
    | {
        headers?: never;
        headersInit?: HeadersInit;
      }
  );

export type ClientOptions<
  TWithoutHeaders extends "Content-Type" | "Cookie" = never,
  TWithoutInit extends "body" | "headers" | "headersInit" = never,
> = {
  fetch?: typeof fetch;
  init?: DistributeOmit<TypedRequestInit<TWithoutHeaders>, TWithoutInit>;
};

declare const __proxy: unique symbol;
export type Endpoint = { [__proxy]?: true };

export type ParamsKey = "__params";
type IsParams = Record<ParamsKey, unknown>;
export type QueryKey = "__query";
type IsQuery = Record<QueryKey, unknown>;

export type HttpMethodFuncKey = (typeof HTTP_METHOD_FUNC_KEYS)[number];
type IsHttpMethod = {
  [K in HttpMethodFuncKey]?: unknown;
};

type IsOptionalCatchAll = `${typeof OPTIONAL_CATCH_ALL_PREFIX}${string}`;
type IsCatchAll = `${typeof CATCH_ALL_PREFIX}${string}`;
type IsDynamic = `${typeof DYNAMIC_PREFIX}${string}`;

export type FuncParams<
  T = Record<string, string | number | string[] | undefined>,
> = T;

type Params<T = unknown> = T extends IsParams
  ? T[ParamsKey]
  : Record<string, string>;

type QueryUrlOptions<TQuery> =
  AllOptional<TQuery> extends true
    ? { query?: TQuery; hash?: string }
    : { query: TQuery; hash?: string };

type UrlOptionsForEndpoint<T, TQuery> = T extends IsQuery
  ? QueryUrlOptions<T[QueryKey]>
  : IsNever<TQuery> extends true
    ? { hash?: string }
    : QueryUrlOptions<TQuery>;

export type UrlOptions<T = unknown, TQuery = unknown> = UrlOptionsForEndpoint<
  T,
  TQuery
>;

export type UrlResult<T = unknown> = {
  pathname: string;
  path: string;
  relativePath: string;
  params: Params<T>;
};

type IsNever<T> = [T] extends [never] ? true : false;
type AllOptional<T> = Partial<T> extends T ? true : false;

type UrlArgs<T, TQuery, TUrlOptions = UrlOptions<T, TQuery>> =
  AllOptional<TUrlOptions> extends true
    ? [url?: TUrlOptions]
    : [url: TUrlOptions];
type UrlArgsObj<T, TQuery, TUrlOptions = UrlOptions<T, TQuery>> =
  AllOptional<TUrlOptions> extends true
    ? { url?: TUrlOptions }
    : { url: TUrlOptions };

export type BodyOptions<TJson = unknown> = { json: TJson };
type BodyArgsObj<TJson> =
  IsNever<TJson> extends true ? unknown : { body: BodyOptions<TJson> };

export type HeadersOptions<THeaders = unknown, TCookies = unknown> = {
  headers: THeaders;
  cookies: TCookies;
};

type QueryInputForValidation<TValidationSchema extends ValidationSchema> =
  ValidationInputFor<"query", TValidationSchema>;

type JsonInputForValidation<TValidationSchema extends ValidationSchema> =
  ValidationInputFor<"json", TValidationSchema>;

type HeadersInputForValidation<TValidationSchema extends ValidationSchema> =
  ValidationInputFor<"headers", TValidationSchema>;

type CookiesInputForValidation<TValidationSchema extends ValidationSchema> =
  ValidationInputFor<"cookies", TValidationSchema>;

type RequestHeadersArgs<THeaders = unknown, TCookies = unknown> =
  IsNever<THeaders> extends true
    ? IsNever<TCookies> extends true
      ? unknown
      : { requestHeaders: Pick<HeadersOptions<THeaders, TCookies>, "cookies"> }
    : IsNever<TCookies> extends true
      ? { requestHeaders: Pick<HeadersOptions<THeaders, TCookies>, "headers"> }
      : { requestHeaders: HeadersOptions<THeaders, TCookies> };

type MethodParameterBase<
  T,
  TValidationSchema extends ValidationSchema,
> = UrlArgsObj<T, QueryInputForValidation<TValidationSchema>> &
  BodyArgsObj<JsonInputForValidation<TValidationSchema>> &
  RequestHeadersArgs<
    HeadersInputForValidation<TValidationSchema>,
    CookiesInputForValidation<TValidationSchema>
  >;

type ClientOptionRestrictedHeaders<TValidationSchema extends ValidationSchema> =
  | (IsNever<JsonInputForValidation<TValidationSchema>> extends true
      ? never
      : "Content-Type")
  | (IsNever<CookiesInputForValidation<TValidationSchema>> extends true
      ? never
      : "Cookie");

type ClientOptionRestrictedInit<TValidationSchema extends ValidationSchema> =
  | (IsNever<JsonInputForValidation<TValidationSchema>> extends true
      ? never
      : "body")
  | (IsNever<HeadersInputForValidation<TValidationSchema>> extends true
      ? never
      : "headers" | "headersInit");

type MethodParameterTuple<TBaseArgs> = [
  ...(AllOptional<TBaseArgs> extends true
    ? [methodParam?: TBaseArgs]
    : [methodParam: TBaseArgs]),
];

type HttpMethodsArgs<
  T,
  TValidationSchema extends ValidationSchema,
  TBaseArgs = MethodParameterBase<T, TValidationSchema>,
> = [
  ...MethodParameterTuple<TBaseArgs>,
  option?: ClientOptions<
    ClientOptionRestrictedHeaders<TValidationSchema>,
    ClientOptionRestrictedInit<TValidationSchema>
  >,
];

type InferHttpMethods<T extends IsHttpMethod> = {
  [K in keyof T as K extends HttpMethodFuncKey ? K : never]: (
    ...args: HttpMethodsArgs<T, InferRouteValidationSchema<T[K]>>
  ) => Promise<InferClientResponse<T[K]>>;
};

type InferEndpointValidationSchema<T> = {
  [K in keyof T]: K extends HttpMethodFuncKey
    ? InferRouteValidationSchema<T[K]>
    : never;
}[keyof T & HttpMethodFuncKey];

type InferRouteValidationSchema<T> = T extends (
  // biome-ignore lint/suspicious/noExplicitAny: intentional for existing type patterns
  ...args: any[]
) => RouteHandlerResponse<RouteResponse, infer TValidationSchema>
  ? TValidationSchema
  : ValidationSchema;

type InferNextResponseType<T> = T extends (
  // biome-ignore lint/suspicious/noExplicitAny: intentional for existing type patterns
  ...args: any[]
) => Promise<NextResponse<infer U>>
  ? U
  : never;

type InferClientResponse<T> = T extends (
  // biome-ignore lint/suspicious/noExplicitAny: intentional for existing type patterns
  ...args: any[]
) => Promise<TypedNextResponse>
  ? Awaited<ReturnType<T>>
  : TypedNextResponse<InferNextResponseType<T>, HttpStatusCode, ContentType>;

type PathProxyAsProperty<T> = {
  $match: (path: string) =>
    | ({
        params: Params<T>;
      } & Partial<UrlOptions<T, InferQuery<T>>>)
    | null;
};

type InferQuery<T> = QueryInputForValidation<InferEndpointValidationSchema<T>>;

type PathProxyAsFunction<T> = {
  $url: (...args: UrlArgs<T, InferQuery<T>>) => UrlResult<T>;
} & (T extends IsHttpMethod ? InferHttpMethods<T> : unknown);

type ParamFunction<T, TParamArgs extends unknown[]> = (
  ...args: TParamArgs
) => DynamicPathProxyAsFunction<T>;

type NonEmptyArray<T> = [T, ...T[]];

export type DynamicPathProxyAsFunction<T> = Omit<
  (T extends Endpoint ? PathProxyAsFunction<T> : unknown) & {
    [K in keyof T]: K extends IsOptionalCatchAll
      ? ParamFunction<T[K], [value?: string[]]>
      : K extends IsCatchAll
        ? ParamFunction<T[K], [value: NonEmptyArray<string>]>
        : K extends IsDynamic
          ? ParamFunction<T[K], [value: string | number]>
          : DynamicPathProxyAsFunction<T[K]>;
  },
  QueryKey | ParamsKey
>;

export type DynamicPathProxyAsProperty<T> = Omit<
  (T extends Endpoint ? PathProxyAsProperty<T> : unknown) & {
    [K in keyof T]: K extends unknown
      ? DynamicPathProxyAsProperty<T[K]>
      : DynamicPathProxyAsProperty<T[K]>;
  },
  QueryKey | ParamsKey
>;

export type RpcHandler = (
  key: string,
  context: {
    paths: string[];
    params: FuncParams;
    dynamicKeys: string[];
    options: ClientOptions;
  },
) => unknown | undefined;
