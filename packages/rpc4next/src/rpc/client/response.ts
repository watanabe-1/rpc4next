import type { ContentType } from "../lib/content-type-types";
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

type JsonContentType = "application/json" | `${string}+json`;
type TextContentType = `text/${string}`;
type FormDataContentType = "multipart/form-data" | "application/x-www-form-urlencoded";

type ParsedPayload<TResponse> =
  TResponse extends TypedNextResponse<infer TData, any, infer TContentType>
    ? ParsedPayloadByContentType<TData, TContentType>
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

export class RpcResponseError<
  TPayload = unknown,
  TResponse extends BodyParserResponseLike = BodyParserResponseLike,
> extends Error {
  readonly status: number;
  readonly statusText: string;
  readonly payload: TPayload;
  readonly response: TResponse;

  constructor(response: TResponse, payload: TPayload) {
    const statusText = response.statusText || "Unknown status";

    super(`RPC response failed with status ${response.status} ${statusText}`);
    this.name = "RpcResponseError";
    this.status = response.status;
    this.statusText = response.statusText;
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

export const parseResponse = async <TResponse extends BodyParserResponseLike>(
  responseOrPromise: TResponse | Promise<TResponse>,
): Promise<SuccessfulResponsePayload<TResponse>> => {
  const response = await responseOrPromise;
  const payload = await parsePayload(response);

  if (!response.ok) {
    throw new RpcResponseError(response, payload);
  }

  return payload as SuccessfulResponsePayload<TResponse>;
};
