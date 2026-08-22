import type { ContentType } from "../lib/content-type-types";
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

type SuccessfulResponse<TResponse> = Extract<TResponse, { readonly ok: true }>;
type ErrorResponse<TResponse> = Extract<TResponse, { readonly ok: false }>;

type JsonContentType = "application/json" | `${string}+json`;
type TextContentType = `text/${string}`;
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
  ErrorResponsePayload<TResponse> extends RpcErrorEnvelope<infer TCode, any> ? TCode : never;

type RpcErrorCodeFromPayload<TPayload> =
  TPayload extends RpcErrorEnvelope<infer TCode, any> ? TCode : string;

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

const isJsonContentType = (contentType: string) => {
  const mediaType = contentType.split(";", 1)[0]?.trim().toLowerCase() ?? "";

  return mediaType === "application/json" || mediaType.endsWith("+json");
};

const isTextContentType = (contentType: string) => {
  return contentType.trim().toLowerCase().startsWith("text/");
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

export type RpcResponsePromise<TResponse> = Promise<TResponse> & {
  unwrap: () => Promise<SuccessfulResponsePayload<TResponse>>;
};

export const createRpcResponsePromise = <TResponse extends BodyParserResponseLike>(
  responsePromise: Promise<TResponse>,
): RpcResponsePromise<TResponse> => {
  const rpcResponsePromise = responsePromise as RpcResponsePromise<TResponse>;

  void Object.defineProperty(rpcResponsePromise, "unwrap", {
    configurable: true,
    value: () => parseResponse(rpcResponsePromise),
  });

  return rpcResponsePromise;
};
