import { createUrl } from "./url";
import { deepMerge } from "./utils";
import type {
  FuncParams,
  UrlOptions,
  ClientOptions,
  TypedRequestInit,
  BodyOptions,
} from "./types";
import type { ContentType } from "../server/types";

const normalizeHeaders = (headers?: HeadersInit): Record<string, string> => {
  const result: Record<string, string> = {};
  if (!headers) return result;
  if (headers instanceof Headers) {
    headers.forEach((value, key) => {
      result[key.toLowerCase()] = value;
    });

    return result;
  }
  if (Array.isArray(headers)) {
    headers.forEach(([key, value]) => {
      result[key.toLowerCase()] = value;
    });

    return result;
  }
  Object.entries(headers).forEach(([key, value]) => {
    result[key.toLowerCase()] = value;
  });

  return result;
};

export const httpMethod = (
  key: string,
  paths: string[],
  params: FuncParams,
  dynamicKeys: string[],
  defaultOptions: ClientOptions
) => {
  return async (
    methodParam?: { url?: UrlOptions; body?: BodyOptions },
    options?: ClientOptions
  ) => {
    let methodParamBody: BodyInit | undefined = undefined;
    let methodParamContentType: ContentType | undefined = undefined;

    if (methodParam?.body?.json) {
      methodParamContentType = "application/json";
      methodParamBody = JSON.stringify(methodParam.body.json);
    }

    const urlObj = createUrl([...paths], params, dynamicKeys)(methodParam?.url);
    const method = key.replace(/^\$/, "").toUpperCase();

    const customFetch = options?.fetch || defaultOptions.fetch || fetch;

    const defaultInit = defaultOptions.init || {};
    const innerInit = options?.init || {};

    const defaultHeaders = normalizeHeaders(defaultInit.headers);
    const innerHeaders = normalizeHeaders(innerInit.headers);
    const mergedHeaders: Record<string, string> = {
      ...defaultHeaders,
      ...innerHeaders,
    };

    if (methodParamContentType) {
      mergedHeaders["content-type"] = methodParamContentType;
    }

    const { headers: _defaultHeaders, ...defaultInitWithoutHeaders } =
      defaultInit;
    const { headers: _innerHeaders, ...innerInitWithoutHeaders } = innerInit;
    const mergedInit: TypedRequestInit<ContentType> = deepMerge(
      defaultInitWithoutHeaders,
      innerInitWithoutHeaders
    );
    mergedInit.method = method;

    if (Object.keys(mergedHeaders).length > 0) {
      mergedInit.headers = mergedHeaders;
    }

    if (methodParamBody) {
      mergedInit.body = methodParamBody;
    }

    const response = await customFetch(urlObj.path, mergedInit);

    return response;
  };
};
