import type {
  OPTIONAL_CATCH_ALL_PREFIX,
  CATCH_ALL_PREFIX,
  DYNAMIC_PREFIX,
  HTTP_METHOD_FUNC_KEYS,
} from "../../lib/constants";
import type {
  TypedNextResponse,
  HttpStatusCode,
  ContentType,
} from "../server/types";
import type { NextResponse } from "next/server";

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
 * Extension of the standard `RequestInit` interface with strongly typed headers.
 */
export interface TypedRequestInit extends RequestInit {
  headers?: HttpRequestHeaders | HeadersInit;
}

export type ClientOptions = { fetch?: typeof fetch; init?: TypedRequestInit };

declare const __proxy: unique symbol;
export type Endpoint = { [__proxy]?: true };

export type ParamsKey = "__params";
type IsParams = Record<ParamsKey, unknown>;
export type QueryKey = "__query";
type IsQuery = Record<QueryKey, unknown>;
export type OptionalQueryKey = "__op_query";
type IsOptionalQuery = Record<OptionalQueryKey, unknown>;

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
type QueryParams<T = Record<string, string | number>> = T;

type Params<T = unknown> = T extends IsParams
  ? T[ParamsKey]
  : Record<string, string>;

export type UrlOptions<T = unknown> = T extends IsQuery
  ? { query: T[QueryKey]; hash?: string }
  : T extends IsOptionalQuery
    ? { query?: T[OptionalQueryKey]; hash?: string }
    : { query?: QueryParams; hash?: string };

export type UrlResult<T = unknown> = {
  pathname: string;
  path: string;
  relativePath: string;
  params: Params<T>;
};

type UrlArg<T> = T extends IsQuery
  ? [url: UrlOptions<T>]
  : [url?: UrlOptions<T>];

type HttpMethodsArg<T> = [...UrlArg<T>, option?: ClientOptions];
type InferHttpMethods<T extends IsHttpMethod> = {
  [K in keyof T as K extends HttpMethodFuncKey ? K : never]: (
    ...args: HttpMethodsArg<T>
  ) => Promise<InferTypedNextResponseType<T[K]>>;
};

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

type PathProxyAsProperty<T> = { $match: (path: string) => Params<T> | null };

type PathProxyAsFunction<T> = {
  $url: (...args: UrlArg<T>) => UrlResult<T>;
} & (T extends IsHttpMethod ? InferHttpMethods<T> : unknown);

type ParamFunction<T, TParamArgs extends unknown[]> = ((
  ...args: [...TParamArgs]
) => DynamicPathProxyAsFunction<T>) &
  DynamicPathProxyAsFunction<T>;

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
  QueryKey | OptionalQueryKey | ParamsKey
>;

export type DynamicPathProxyAsProperty<T> = Omit<
  (T extends Endpoint ? PathProxyAsProperty<T> : unknown) & {
    [K in keyof T]: K extends unknown
      ? DynamicPathProxyAsProperty<T[K]>
      : DynamicPathProxyAsProperty<T[K]>;
  },
  QueryKey | OptionalQueryKey | ParamsKey
>;
