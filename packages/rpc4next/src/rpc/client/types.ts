import type {
  OPTIONAL_CATCH_ALL_PREFIX,
  CATCH_ALL_PREFIX,
  DYNAMIC_PREFIX,
  HTTP_METHOD_FUNC_KEYS,
} from "../lib/constants";
import type { ContentType } from "../lib/content-type-types";
import type { HttpRequestHeaders } from "../lib/http-request-headers-types";
import type { HttpStatusCode } from "../lib/http-status-code-types";
import type {
  RouteHandlerResponse,
  RouteResponse,
  ValidationSchema,
} from "../server/route-types";
import type { TypedNextResponse, ValidationInputFor } from "../server/types";
import type { NextResponse } from "next/server";

// eslint-disable-next-line @typescript-eslint/no-explicit-any
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

export type UrlOptions<T = unknown, TQuery = unknown> = T extends IsQuery
  ? AllOptional<T[QueryKey]> extends true
    ? { query?: T[QueryKey]; hash?: string }
    : { query: T[QueryKey]; hash?: string }
  : IsNever<TQuery> extends true
    ? { hash?: string }
    : AllOptional<TQuery> extends true
      ? { query?: TQuery; hash?: string }
      : { query: TQuery; hash?: string };

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
type HeadersArgsObj<THeaders = unknown, TCookies = unknown> =
  IsNever<THeaders> extends true
    ? IsNever<TCookies> extends true
      ? unknown
      : { requestHeaders: Pick<HeadersOptions<THeaders, TCookies>, "cookies"> }
    : IsNever<TCookies> extends true
      ? { requestHeaders: Pick<HeadersOptions<THeaders, TCookies>, "headers"> }
      : { requestHeaders: HeadersOptions<THeaders, TCookies> };

type HttpMethodsArgs<
  T,
  TValidationSchema extends ValidationSchema,
  TQuery = ValidationInputFor<"query", TValidationSchema>,
  TJson = ValidationInputFor<"json", TValidationSchema>,
  THeaders = ValidationInputFor<"headers", TValidationSchema>,
  TCookies = ValidationInputFor<"cookies", TValidationSchema>,
  TBaseArgs = UrlArgsObj<T, TQuery> &
    BodyArgsObj<TJson> &
    HeadersArgsObj<THeaders, TCookies>,
> = [
  ...(AllOptional<TBaseArgs> extends true
    ? [methodParam?: TBaseArgs]
    : [methodParam: TBaseArgs]),
  option?: ClientOptions<
    | (IsNever<TJson> extends true ? never : "Content-Type")
    | (IsNever<TCookies> extends true ? never : "Cookie"),
    | (IsNever<TJson> extends true ? never : "body")
    | (IsNever<THeaders> extends true ? never : "headers" | "headersInit")
  >,
];

type InferHttpMethods<T extends IsHttpMethod> = {
  [K in keyof T as K extends HttpMethodFuncKey ? K : never]: (
    ...args: HttpMethodsArgs<T, InferValidationSchema<T[K]>>
  ) => Promise<InferTypedNextResponseType<T[K]>>;
};

type InferHttpMethodValidationSchema<T> = {
  [K in keyof T]: K extends HttpMethodFuncKey
    ? InferValidationSchema<T[K]>
    : never;
}[keyof T & HttpMethodFuncKey];

type InferValidationSchema<T> = T extends (
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  ...args: any[]
) => RouteHandlerResponse<RouteResponse, infer TValidationSchema>
  ? TValidationSchema
  : ValidationSchema;

type InferNextResponseType<T> = T extends (
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  ...args: any[]
) => Promise<NextResponse<infer U>>
  ? U
  : never;

type InferTypedNextResponseType<T> = T extends (
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
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

type InferQuery<T> = ValidationInputFor<
  "query",
  InferHttpMethodValidationSchema<T>
>;

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
  }
) => unknown | undefined;
