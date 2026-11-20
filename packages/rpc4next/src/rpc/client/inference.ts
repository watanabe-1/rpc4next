import type { ContentType } from "../lib/content-type-types";
import type { SuccessfulHttpStatusCode } from "../lib/http-status-code-types";
import type { RpcErrorEnvelope } from "../server/error";
import type { TypedNextResponse } from "../server/types";

type SuccessfulResponse<TResponse> =
  TResponse extends TypedNextResponse<unknown, infer TStatus, ContentType>
    ? TStatus extends SuccessfulHttpStatusCode
      ? TResponse
      : never
    : Extract<TResponse, { readonly ok: true }>;
type ErrorResponse<TResponse> =
  TResponse extends TypedNextResponse<unknown, infer TStatus, ContentType>
    ? TStatus extends SuccessfulHttpStatusCode
      ? never
      : TResponse
    : Extract<TResponse, { readonly ok: false }>;
type RpcResponseSource<TMethodOrResponsePromise> = TMethodOrResponsePromise extends {
  (...args: infer _TArgs): infer TResponsePromise;
}
  ? Awaited<TResponsePromise>
  : Awaited<TMethodOrResponsePromise>;

type JsonContentType = "application/json" | `${string}+json`;
type XmlContentType = "application/xml" | `application/${string}+xml`;
type YamlContentType = "application/yaml" | "application/x-yaml" | `application/${string}+yaml`;
type TextContentType = `text/${string}` | XmlContentType | YamlContentType;
type FormDataContentType = "multipart/form-data" | "application/x-www-form-urlencoded";
type NoBodyStatus = 101 | 204 | 205 | 304;

type ParsedPayload<TResponse> =
  TResponse extends TypedNextResponse<infer TData, infer TStatus, infer TContentType>
    ? TStatus extends NoBodyStatus
      ? undefined
      : ParsedPayloadByContentType<TData, TContentType>
    : TResponse extends { json: () => Promise<infer TPayload> }
      ? TPayload
      : never;

type ParsedPayloadByContentType<
  TData,
  TContentType extends ContentType,
> = TContentType extends JsonContentType
  ? TData
  : TContentType extends TextContentType
    ? TData extends string
      ? TData
      : string
    : TContentType extends FormDataContentType
      ? FormData
      : Blob;

/** Infers the parsed success payload for a typed RPC response or response promise. */
export type SuccessfulResponsePayload<TResponse> = [
  SuccessfulResponse<Awaited<TResponse>>,
] extends [never]
  ? ParsedPayload<Awaited<TResponse>>
  : ParsedPayload<SuccessfulResponse<Awaited<TResponse>>>;

/** Alias for `SuccessfulResponsePayload`; kept for callers that expect JSON success bodies. */
export type SuccessfulJsonPayload<TResponse> = SuccessfulResponsePayload<TResponse>;

/** Infers the parsed non-2xx payload for a typed RPC response or response promise. */
export type ErrorResponsePayload<TResponse> = [ErrorResponse<Awaited<TResponse>>] extends [never]
  ? never
  : ParsedPayload<ErrorResponse<Awaited<TResponse>>>;

/** Infers the rpc4next error code union from a typed non-2xx error payload. */
export type ErrorResponseCode<TResponse> =
  ErrorResponsePayload<TResponse> extends RpcErrorEnvelope<infer TCode, unknown> ? TCode : never;

type RpcRequestInput<TMethod> = TMethod extends { (...args: infer TArgs): unknown }
  ? TArgs extends []
    ? undefined
    : TArgs[0]
  : never;

type RpcResponseByStatus<
  TMethodOrResponsePromise,
  TStatus extends number,
  TResponse = RpcResponseSource<TMethodOrResponsePromise>,
> = TResponse extends { readonly status: infer TResponseStatus }
  ? TStatus extends TResponseStatus
    ? TResponse
    : never
  : never;

type RpcPayloadByStatus<TMethodOrResponsePromise, TStatus extends number> = ParsedPayload<
  RpcResponseByStatus<TMethodOrResponsePromise, TStatus>
>;

type RpcSuccessPayload<TMethodOrResponsePromise> = SuccessfulResponsePayload<
  RpcResponseSource<TMethodOrResponsePromise>
>;

type RpcErrorPayload<TMethodOrResponsePromise> = ErrorResponsePayload<
  RpcResponseSource<TMethodOrResponsePromise>
>;

type RpcErrorCode<TMethodOrResponsePromise> = ErrorResponseCode<
  RpcResponseSource<TMethodOrResponsePromise>
>;

type RpcRequestInferTarget = "input" | "query" | "json" | "formData" | "headers" | "cookies";
type RpcResponseInferStatus = number | "success" | "error";
type RpcResponseInferSelect = "payload" | "response";

type ExtractQueryInput<TInput> =
  NonNullable<TInput> extends { query?: infer TQuery }
    ? TQuery
    : NonNullable<TInput> extends { query: infer TQuery }
      ? TQuery
      : NonNullable<TInput> extends { url?: infer TUrl }
        ? ExtractQueryInput<TUrl>
        : NonNullable<TInput> extends { url: infer TUrl }
          ? ExtractQueryInput<TUrl>
          : never;

type ExtractJsonInput<TInput> =
  NonNullable<TInput> extends {
    body?: {
      json?: infer TJson;
    };
  }
    ? TJson
    : NonNullable<TInput> extends {
          body: {
            json: infer TJson;
          };
        }
      ? TJson
      : never;

type ExtractFormDataInput<TInput> =
  NonNullable<TInput> extends {
    body?: {
      formData?: infer TFormData;
    };
  }
    ? TFormData
    : NonNullable<TInput> extends {
          body: {
            formData: infer TFormData;
          };
        }
      ? TFormData
      : never;

type ExtractHeadersInput<TInput> =
  NonNullable<TInput> extends {
    requestHeaders?: {
      headers?: infer THeaders;
    };
  }
    ? THeaders
    : NonNullable<TInput> extends {
          requestHeaders: {
            headers: infer THeaders;
          };
        }
      ? THeaders
      : never;

type ExtractCookiesInput<TInput> =
  NonNullable<TInput> extends {
    requestHeaders?: {
      cookies?: infer TCookies;
    };
  }
    ? TCookies
    : NonNullable<TInput> extends {
          requestHeaders: {
            cookies: infer TCookies;
          };
        }
      ? TCookies
      : never;

type RpcQueryInput<TMethodOrUrl> = TMethodOrUrl extends {
  (...args: infer TArgs): unknown;
}
  ? ExtractQueryInput<TArgs[0]>
  : ExtractQueryInput<TMethodOrUrl>;

type RpcJsonInput<TMethod> = ExtractJsonInput<RpcRequestInput<TMethod>>;

type RpcFormDataInput<TMethod> = ExtractFormDataInput<RpcRequestInput<TMethod>>;

type RpcHeadersInput<TMethod> = ExtractHeadersInput<RpcRequestInput<TMethod>>;

type RpcCookiesInput<TMethod> = ExtractCookiesInput<RpcRequestInput<TMethod>>;

/**
 * Infers the input object accepted by a generated RPC method or `$url` helper.
 *
 * Pass a target such as `"query"`, `"json"`, `"formData"`, `"headers"`, or `"cookies"` when a form,
 * hook, or fixture only needs one part of the request.
 */
export type InferRpcRequestType<
  TMethodOrUrl,
  TTarget extends RpcRequestInferTarget = "input",
> = TTarget extends "input"
  ? RpcRequestInput<TMethodOrUrl>
  : TTarget extends "query"
    ? RpcQueryInput<TMethodOrUrl>
    : TTarget extends "json"
      ? RpcJsonInput<TMethodOrUrl>
      : TTarget extends "formData"
        ? RpcFormDataInput<TMethodOrUrl>
        : TTarget extends "headers"
          ? RpcHeadersInput<TMethodOrUrl>
          : TTarget extends "cookies"
            ? RpcCookiesInput<TMethodOrUrl>
            : never;

/**
 * Infers a parsed RPC response payload.
 *
 * The default returns the success payload. Pass `"error"` for all error payloads, a numeric status
 * for a status-specific payload, or `"response"` as the third generic to keep the typed `Response`
 * branch instead of parsing it.
 */
export type InferRpcResponseType<
  TMethodOrResponsePromise,
  TStatus extends RpcResponseInferStatus = "success",
  TSelect extends RpcResponseInferSelect = "payload",
> = TStatus extends "success"
  ? RpcSuccessPayload<TMethodOrResponsePromise>
  : TStatus extends "error"
    ? RpcErrorPayload<TMethodOrResponsePromise>
    : TStatus extends number
      ? TSelect extends "response"
        ? RpcResponseByStatus<TMethodOrResponsePromise, TStatus>
        : RpcPayloadByStatus<TMethodOrResponsePromise, TStatus>
      : never;

/** Infers the rpc4next error code union produced by a generated RPC method. */
export type InferRpcErrorCode<TMethodOrResponsePromise> = RpcErrorCode<TMethodOrResponsePromise>;
