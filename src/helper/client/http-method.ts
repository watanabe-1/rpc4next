import { createUrl } from "./url";
import { deepMerge } from "./utils";
import type {
  FuncParams,
  UrlOptions,
  ClientOptions,
  TypedRequestInit,
} from "./types";

function normalizeHeaders(headers?: HeadersInit): Record<string, string> {
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
}

export const httpMethod = (
  key: string,
  paths: string[],
  params: FuncParams,
  dynamicKeys: string[],
  defaultOptions: ClientOptions
) => {
  return async (url?: UrlOptions, options?: ClientOptions) => {
    const urlObj = createUrl([...paths], params, dynamicKeys)(url);
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

    const { headers: _defaultHeaders, ...defaultInitWithoutHeaders } =
      defaultInit;
    const { headers: _innerHeaders, ...innerInitWithoutHeaders } = innerInit;
    const mergedInit: TypedRequestInit = deepMerge(
      defaultInitWithoutHeaders,
      innerInitWithoutHeaders
    );
    mergedInit.method = method;
    if (Object.keys(mergedHeaders).length > 0) {
      mergedInit.headers = mergedHeaders;
    }

    const response = await customFetch(urlObj.path, mergedInit);

    return response;
  };
};
