import type { NextResponse } from "next/server";
import type {
  CATCH_ALL_PREFIX,
  DYNAMIC_PREFIX,
  HTTP_METHOD_FUNC_KEYS,
  OPTIONAL_CATCH_ALL_PREFIX,
} from "rpc4next-shared";
import type { ContentType } from "../lib/content-type-types";
import type { HttpRequestHeaders } from "../lib/http-request-headers-types";
import type {
  HttpStatusCode,
  SuccessfulHttpStatusCode,
} from "../lib/http-status-code-types";
import type {
  ProcedureInputContract,
  ProcedureOutputContract,
  WithProcedureDefinition,
} from "../server/procedure-types";
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

export type RpcClientOptions<
  TWithoutHeaders extends "Content-Type" | "Cookie" = never,
  TWithoutInit extends "body" | "headers" | "headersInit" = never,
> = {
  fetch?: typeof fetch;
  init?: DistributeOmit<TypedRequestInit<TWithoutHeaders>, TWithoutInit>;
};

declare const __proxy: unique symbol;
export type RpcEndpoint = { [__proxy]?: true };

export type ParamsKey = "__params";
type HasParamsMarker = Record<ParamsKey, unknown>;
export type QueryKey = "__query";
type HasQueryMarker = Record<QueryKey, unknown>;

export type HttpMethodFuncKey = (typeof HTTP_METHOD_FUNC_KEYS)[number];
type HttpMethodMapLike = {
  [K in HttpMethodFuncKey]?: unknown;
};

type OptionalCatchAllKey = `${typeof OPTIONAL_CATCH_ALL_PREFIX}${string}`;
type CatchAllKey = `${typeof CATCH_ALL_PREFIX}${string}`;
type DynamicKey = `${typeof DYNAMIC_PREFIX}${string}`;

export type PathParamsInput<
  T = Record<string, string | number | string[] | undefined>,
> = T;

type ExtractParams<T = unknown> = T extends HasParamsMarker
  ? T[ParamsKey]
  : Record<string, string>;

export type UrlOptions<T = unknown, TQuery = unknown> = T extends HasQueryMarker
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
  params: ExtractParams<T>;
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

export type JsonBodyOptions<TJson = unknown> = { json: TJson };
type BodyArgsObj<TJson> =
  IsNever<TJson> extends true ? unknown : { body: JsonBodyOptions<TJson> };

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

type MethodInitExclusions<TJson, TCookies> =
  | (IsNever<TJson> extends true ? never : "Content-Type")
  | (IsNever<TCookies> extends true ? never : "Cookie");
type MethodOptionExclusions<TJson, THeaders> =
  | (IsNever<TJson> extends true ? never : "body")
  | (IsNever<THeaders> extends true ? never : "headers" | "headersInit");

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
  option?: RpcClientOptions<
    MethodInitExclusions<TJson, TCookies>,
    MethodOptionExclusions<TJson, THeaders>
  >,
];

type InferHttpMethods<T extends HttpMethodMapLike> = {
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
  // biome-ignore lint/suspicious/noExplicitAny: intentional for existing type patterns
  ...args: any[]
) => RouteHandlerResponse<RouteResponse, infer TValidationSchema>
  ? TValidationSchema
  : T extends WithProcedureDefinition<unknown, infer TDefinition>
    ? TDefinition extends {
        input: ProcedureInputContract<infer TValidationSchema>;
      }
      ? TValidationSchema
      : ValidationSchema
    : ValidationSchema;

type InferNextResponseType<T> = T extends (
  // biome-ignore lint/suspicious/noExplicitAny: intentional for existing type patterns
  ...args: any[]
) => Promise<NextResponse<infer U>>
  ? U
  : never;

type InferProcedureOutput<T> =
  T extends WithProcedureDefinition<unknown, infer TDefinition>
    ? TDefinition extends {
        output: ProcedureOutputContract<infer TOutput>;
      }
      ? TOutput
      : never
    : never;

type ReplaceSuccessResponseBody<TResponse, TOutput> =
  TResponse extends TypedNextResponse<
    unknown,
    infer TStatus,
    infer TContentType
  >
    ? TStatus extends SuccessfulHttpStatusCode
      ? TypedNextResponse<TOutput, TStatus, TContentType>
      : TResponse
    : never;

type InferTypedNextResponseTypeFromOutput<T, TOutput> = T extends (
  // biome-ignore lint/suspicious/noExplicitAny: intentional for existing type patterns
  ...args: any[]
) => Promise<infer TResponse>
  ? [ReplaceSuccessResponseBody<TResponse, TOutput>] extends [never]
    ? TypedNextResponse<TOutput, HttpStatusCode, ContentType>
    : ReplaceSuccessResponseBody<TResponse, TOutput>
  : TypedNextResponse<TOutput, HttpStatusCode, ContentType>;

type InferTypedNextResponseType<T> = T extends (
  // biome-ignore lint/suspicious/noExplicitAny: intentional for existing type patterns
  ...args: any[]
) => Promise<unknown>
  ? IsNever<InferProcedureOutput<T>> extends true
    ? T extends (
        // biome-ignore lint/suspicious/noExplicitAny: intentional for existing type patterns
        ...args: any[]
      ) => Promise<TypedNextResponse>
      ? Awaited<ReturnType<T>>
      : TypedNextResponse<InferNextResponseType<T>, HttpStatusCode, ContentType>
    : InferTypedNextResponseTypeFromOutput<T, InferProcedureOutput<T>>
  : TypedNextResponse<InferNextResponseType<T>, HttpStatusCode, ContentType>;

type PathProxyAsProperty<T> = {
  $match: (path: string) =>
    | ({
        params: ExtractParams<T>;
      } & Partial<UrlOptions<T, InferQuery<T>>>)
    | null;
};

type InferQuery<T> = ValidationInputFor<
  "query",
  InferHttpMethodValidationSchema<T>
>;

type PathProxyAsFunction<T> = {
  $url: (...args: UrlArgs<T, InferQuery<T>>) => UrlResult<T>;
} & (T extends HttpMethodMapLike ? InferHttpMethods<T> : unknown);

type ParamFunction<T, TParamArgs extends unknown[]> = (
  ...args: TParamArgs
) => DynamicPathProxyAsFunction<T>;

type NonEmptyArray<T> = [T, ...T[]];

export type DynamicPathProxyAsFunction<T> = Omit<
  (T extends RpcEndpoint ? PathProxyAsFunction<T> : unknown) & {
    [K in keyof T]: K extends OptionalCatchAllKey
      ? ParamFunction<T[K], [value?: string[]]>
      : K extends CatchAllKey
        ? ParamFunction<T[K], [value: NonEmptyArray<string>]>
        : K extends DynamicKey
          ? ParamFunction<T[K], [value: string | number]>
          : DynamicPathProxyAsFunction<T[K]>;
  },
  QueryKey | ParamsKey
>;

export type DynamicPathProxyAsProperty<T> = Omit<
  (T extends RpcEndpoint ? PathProxyAsProperty<T> : unknown) & {
    [K in keyof T]: K extends unknown
      ? DynamicPathProxyAsProperty<T[K]>
      : DynamicPathProxyAsProperty<T[K]>;
  },
  QueryKey | ParamsKey
>;

export type RpcProxyHandler = (
  key: string,
  context: {
    paths: string[];
    params: PathParamsInput;
    dynamicKeys: string[];
    options: RpcClientOptions;
  },
) => unknown | undefined;
