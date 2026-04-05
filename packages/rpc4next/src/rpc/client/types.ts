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
  RpcErrorCode,
  RpcErrorEnvelope,
  RpcErrorStatus,
} from "../server/error";
import type {
  ProcedureInputContract,
  ProcedureOutputContract,
  ProcedureValidationErrorResponseMap,
  procedureDefinitionSymbol,
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
export type FormDataBodyOptions = { formData: FormData };
type BodyArgsObj<TJson, TFormData> =
  IsNever<TJson> extends true
    ? IsNever<TFormData> extends true
      ? unknown
      : { body: FormDataBodyOptions }
    : { body: JsonBodyOptions<TJson> };

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
  | (IsNever<TJson> extends true
      ? IsNever<TFormData> extends true
        ? never
        : "body"
      : "body")
  | (IsNever<THeaders> extends true ? never : "headers" | "headersInit");

type HttpMethodsArgs<
  TMethod extends HttpMethodFuncKey,
  T,
  TValidationSchema extends ValidationSchema,
  TQuery = ValidationInputFor<"query", TValidationSchema>,
  TJson = TMethod extends "$get" | "$head"
    ? never
    : ValidationInputFor<"json", TValidationSchema>,
  TFormData = TMethod extends "$get" | "$head"
    ? never
    : ValidationInputFor<"formData", TValidationSchema>,
  THeaders = ValidationInputFor<"headers", TValidationSchema>,
  TCookies = ValidationInputFor<"cookies", TValidationSchema>,
  TBaseArgs = UrlArgsObj<T, TQuery> &
    BodyArgsObj<TJson, TFormData> &
    HeadersArgsObj<THeaders, TCookies>,
> = [
  ...(AllOptional<TBaseArgs> extends true
    ? [methodParam?: TBaseArgs]
    : [methodParam: TBaseArgs]),
  option?: RpcClientOptions<
    MethodInitExclusions<TJson, TFormData, TCookies>,
    MethodOptionExclusions<TJson, TFormData, THeaders>
  >,
];

type InferHttpMethods<T extends HttpMethodMapLike> = {
  [K in keyof T as K extends HttpMethodFuncKey ? K : never]: (
    ...args: HttpMethodsArgs<
      Extract<K, HttpMethodFuncKey>,
      T,
      InferValidationSchema<T[K]>
    >
  ) => Promise<InferTypedNextResponseType<T[K]>>;
};

type InferHttpMethodValidationSchema<T> = {
  [K in keyof T]: K extends HttpMethodFuncKey
    ? InferValidationSchema<T[K]>
    : never;
}[keyof T & HttpMethodFuncKey];

type ExtractAttachedProcedureDefinition<T> =
  typeof procedureDefinitionSymbol extends keyof T
    ? T extends WithProcedureDefinition<unknown, infer TDefinition>
      ? TDefinition
      : never
    : never;

type InferValidationSchema<T> =
  ExtractAttachedProcedureDefinition<T> extends {
    input: ProcedureInputContract<infer TValidationSchema>;
  }
    ? TValidationSchema
    : T extends (
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

type InferProcedureOutput<T> =
  ExtractAttachedProcedureDefinition<T> extends {
    output: ProcedureOutputContract<infer TOutput>;
  }
    ? TOutput
    : never;

type ProcedureErrorResponse<
  TCode extends RpcErrorCode = RpcErrorCode,
  TDetails = unknown,
> = TCode extends RpcErrorCode
  ? TypedNextResponse<
      RpcErrorEnvelope<TCode, TDetails>,
      RpcErrorStatus<TCode>,
      "application/json"
    >
  : never;

type ResolveStatus<
  TStatus,
  TDefault extends HttpStatusCode,
> = TStatus extends HttpStatusCode ? TStatus : TDefault;

type InferProcedureValidationErrorResponse<T> =
  ExtractAttachedProcedureDefinition<T> extends {
    input: ProcedureInputContract<
      infer TValidationSchema,
      infer TValidationErrorResponses
    >;
  }
    ? keyof TValidationSchema["input"] extends never
      ? never
      :
          | ProcedureErrorResponse<"BAD_REQUEST">
          | InferProcedureCustomValidationErrorResponse<TValidationErrorResponses>
    : never;

type InferProcedureCustomValidationErrorResponse<TValidationErrorResponses> =
  TValidationErrorResponses extends ProcedureValidationErrorResponseMap
    ? NormalizeProcedureValidationErrorResponse<
        Exclude<
          TValidationErrorResponses[keyof TValidationErrorResponses],
          undefined
        >
      >
    : never;

type NormalizeProcedureValidationErrorResponse<TResult> =
  TResult extends TypedNextResponse
    ? TResult
    : TResult extends NextResponse<infer TData>
      ? TypedNextResponse<TData, HttpStatusCode, ContentType>
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
              ? TypedNextResponse<
                  TBody,
                  ResolveStatus<TStatus, 200>,
                  "text/plain"
                >
              : TypedNextResponse<
                  TBody,
                  ResolveStatus<TStatus, 200>,
                  "application/json"
                >
            : TResult extends {
                  status?: infer TStatus;
                }
              ? TypedNextResponse<
                  undefined,
                  ResolveStatus<TStatus, 200>,
                  ContentType
                >
              : never;

type InferProcedureOutputValidationErrorResponse<T> =
  ExtractAttachedProcedureDefinition<T> extends {
    output: {
      runtime: true;
    };
  }
    ? ProcedureErrorResponse<"INTERNAL_SERVER_ERROR">
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
      ?
          | Awaited<ReturnType<T>>
          | InferProcedureValidationErrorResponse<T>
          | InferProcedureOutputValidationErrorResponse<T>
      :
          | TypedNextResponse<
              InferNextResponseType<T>,
              HttpStatusCode,
              ContentType
            >
          | InferProcedureValidationErrorResponse<T>
          | InferProcedureOutputValidationErrorResponse<T>
    :
        | InferTypedNextResponseTypeFromOutput<T, InferProcedureOutput<T>>
        | InferProcedureValidationErrorResponse<T>
        | InferProcedureOutputValidationErrorResponse<T>
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
