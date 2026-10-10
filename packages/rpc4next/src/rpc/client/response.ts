import type { ContentType } from "../lib/content-type-types";
import type { SuccessfulHttpStatusCode } from "../lib/http-status-code-types";
import type { RpcErrorEnvelope } from "../server/error";
import type { TypedNextResponse } from "../server/types";

type BodyParserResponseLike<TJsonPayload = unknown> = {
  readonly ok: boolean;
  readonly status: number;
  readonly statusText: string;
  readonly headers: Headers;
  arrayBuffer: () => Promise<ArrayBuffer>;
  blob: () => Promise<Blob>;
  formData: () => Promise<FormData>;
  json: () => Promise<TJsonPayload>;
  text: () => Promise<string>;
  clone?: () => BodyParserResponseLike<TJsonPayload>;
};

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
  : TMethodOrResponsePromise extends RpcResponsePromise<infer TResponse>
    ? Awaited<TResponse>
    : Awaited<TMethodOrResponsePromise>;

type JsonContentType = "application/json" | `${string}+json`;
type XmlContentType = "application/xml" | `application/${string}+xml`;
type YamlContentType = "application/yaml" | "application/x-yaml" | `application/${string}+yaml`;
type TextContentType = `text/${string}` | XmlContentType | YamlContentType;
type FormDataContentType = "multipart/form-data" | "application/x-www-form-urlencoded";
type NoBodyStatus = 101 | 204 | 205 | 304;

export type RpcFilePayload<TResponse = unknown> = {
  readonly blob: Blob;
  readonly filename: string | undefined;
  readonly contentType: string;
  readonly response: TResponse;
};

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

export type SuccessfulResponsePayload<TResponse> = [
  SuccessfulResponse<Awaited<TResponse>>,
] extends [never]
  ? ParsedPayload<Awaited<TResponse>>
  : ParsedPayload<SuccessfulResponse<Awaited<TResponse>>>;

export type SuccessfulJsonPayload<TResponse> = SuccessfulResponsePayload<TResponse>;

export type ErrorResponsePayload<TResponse> = [ErrorResponse<Awaited<TResponse>>] extends [never]
  ? never
  : ParsedPayload<ErrorResponse<Awaited<TResponse>>>;

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

export type InferRpcErrorCode<TMethodOrResponsePromise> = RpcErrorCode<TMethodOrResponsePromise>;

type RpcErrorCodeFromPayload<TPayload> =
  TPayload extends RpcErrorEnvelope<infer TCode, unknown> ? TCode : string;

type RpcErrorPayloadByCode<TPayload, TCode extends string> =
  TPayload extends RpcErrorEnvelope<TCode, unknown> ? TPayload : never;

const getRpcErrorCode = <TPayload>(
  payload: TPayload,
): RpcErrorCodeFromPayload<TPayload> | undefined => {
  if (
    typeof payload !== "object" ||
    payload === null ||
    !("error" in payload) ||
    typeof payload.error !== "object" ||
    payload.error === null ||
    !("code" in payload.error) ||
    typeof payload.error.code !== "string"
  ) {
    return undefined;
  }

  return payload.error.code as RpcErrorCodeFromPayload<TPayload>;
};

export class RpcResponseError<
  TPayload = unknown,
  TResponse extends BodyParserResponseLike = BodyParserResponseLike,
> extends Error {
  readonly status: number;
  readonly statusText: string;
  readonly code?: RpcErrorCodeFromPayload<TPayload>;
  readonly payload: TPayload;
  readonly response: TResponse;

  constructor(response: TResponse, payload: TPayload) {
    const statusText = response.statusText || "Unknown status";

    super(`RPC response failed with status ${response.status} ${statusText}`);
    this.name = "RpcResponseError";
    this.status = response.status;
    this.statusText = response.statusText;
    this.code = getRpcErrorCode(payload);
    this.payload = payload;
    this.response = response;
  }
}

export type RpcErrorHandlers<TPayload, TResult> = {
  [TCode in RpcErrorCodeFromPayload<TPayload> & string]: (
    error: RpcResponseError<RpcErrorPayloadByCode<TPayload, TCode>>,
  ) => TResult;
};

export const matchRpcResponseError = <TPayload, TResult>(
  error: RpcResponseError<TPayload>,
  handlers: RpcErrorHandlers<TPayload, TResult>,
): TResult => {
  if (error.code === undefined) {
    throw error;
  }

  const handler = handlers[error.code as RpcErrorCodeFromPayload<TPayload> & string];
  if (!handler) {
    throw error;
  }

  return handler(error as never);
};

const isJsonContentType = (contentType: string) => {
  const mediaType = contentType.split(";", 1)[0]?.trim().toLowerCase() ?? "";

  return mediaType === "application/json" || mediaType.endsWith("+json");
};

const isTextContentType = (contentType: string) => {
  const mediaType = contentType.split(";", 1)[0]?.trim().toLowerCase() ?? "";

  return (
    mediaType.startsWith("text/") ||
    mediaType === "application/xml" ||
    (mediaType.startsWith("application/") && mediaType.endsWith("+xml")) ||
    mediaType === "application/yaml" ||
    mediaType === "application/x-yaml" ||
    (mediaType.startsWith("application/") && mediaType.endsWith("+yaml"))
  );
};

const isFormDataContentType = (contentType: string) => {
  const mediaType = contentType.split(";", 1)[0]?.trim().toLowerCase() ?? "";

  return mediaType === "multipart/form-data" || mediaType === "application/x-www-form-urlencoded";
};

const isNoBodyStatus = (status: number) => {
  return status === 101 || status === 204 || status === 205 || status === 304;
};

const readText = async (response: BodyParserResponseLike): Promise<string | undefined> => {
  try {
    const body = await response.text();

    return body === "" ? undefined : body;
  } catch {
    return undefined;
  }
};

const readJson = async (response: BodyParserResponseLike): Promise<unknown> => {
  const fallbackResponse = response.clone?.();

  try {
    return await response.json();
  } catch {
    return fallbackResponse ? readText(fallbackResponse) : undefined;
  }
};

const parseContentDispositionFilename = (contentDisposition: string | null) => {
  if (!contentDisposition) {
    return undefined;
  }

  const filenameStarMatch = /(?:^|;)\s*filename\*\s*=\s*([^;]+)/i.exec(contentDisposition);
  if (filenameStarMatch?.[1]) {
    const value = filenameStarMatch[1].trim().replace(/^"|"$/g, "");
    const encodedFilename = value.includes("''") ? value.split("''", 2)[1] : value;

    try {
      return decodeURIComponent(encodedFilename);
    } catch {
      return encodedFilename;
    }
  }

  const filenameMatch = /(?:^|;)\s*filename\s*=\s*("[^"]*"|[^;]+)/i.exec(contentDisposition);
  const filename = filenameMatch?.[1]?.trim();

  return filename?.replace(/^"|"$/g, "");
};

const parsePayload = async (response: BodyParserResponseLike): Promise<unknown> => {
  if (isNoBodyStatus(response.status)) {
    return undefined;
  }

  const contentType = response.headers.get("content-type") ?? "";

  if (isJsonContentType(contentType)) {
    return readJson(response);
  }

  if (isTextContentType(contentType)) {
    return readText(response);
  }

  if (isFormDataContentType(contentType)) {
    try {
      return await response.formData();
    } catch {
      return readText(response);
    }
  }

  if (contentType === "") {
    return readText(response);
  }

  try {
    return await response.blob();
  } catch {
    return undefined;
  }
};

const parseResponse = async <TResponse extends BodyParserResponseLike>(
  responseOrPromise: TResponse | Promise<TResponse>,
): Promise<SuccessfulResponsePayload<TResponse>> => {
  const response = await responseOrPromise;
  const payload = await parsePayload(response);

  if (!response.ok) {
    throw new RpcResponseError(response, payload);
  }

  return payload as SuccessfulResponsePayload<TResponse>;
};

const parseFileResponse = async <TResponse extends BodyParserResponseLike>(
  responseOrPromise: TResponse | Promise<TResponse>,
): Promise<RpcFilePayload<TResponse>> => {
  const response = await responseOrPromise;

  if (!response.ok) {
    throw new RpcResponseError(response, await parsePayload(response));
  }

  return {
    blob: await response.blob(),
    filename: parseContentDispositionFilename(response.headers.get("content-disposition")),
    contentType: response.headers.get("content-type") ?? "",
    response,
  };
};

export type RpcResponsePromise<TResponse> = Promise<TResponse> & {
  unwrap: () => Promise<SuccessfulResponsePayload<TResponse>>;
  unwrapFile: () => Promise<RpcFilePayload<TResponse>>;
};

export const createRpcResponsePromise = <TResponse extends BodyParserResponseLike>(
  responsePromise: Promise<TResponse>,
): RpcResponsePromise<TResponse> => {
  const rpcResponsePromise = responsePromise as RpcResponsePromise<TResponse>;

  void Object.defineProperty(rpcResponsePromise, "unwrap", {
    configurable: true,
    value: () => parseResponse(rpcResponsePromise),
  });
  void Object.defineProperty(rpcResponsePromise, "unwrapFile", {
    configurable: true,
    value: () => parseFileResponse(rpcResponsePromise),
  });

  return rpcResponsePromise;
};
