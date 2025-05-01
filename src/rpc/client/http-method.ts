import { deepMerge } from "./client-utils";
import { createUrl } from "./url";
import { normalizeHeaders } from "../lib/headers";
import type {
  FuncParams,
  UrlOptions,
  ClientOptions,
  TypedRequestInit,
  BodyOptions,
  HeadersOptions,
} from "./types";
import type { ContentType } from "../lib/content-type-types";

export const httpMethod = (
  key: string,
  paths: string[],
  params: FuncParams,
  dynamicKeys: string[],
  defaultOptions: ClientOptions
) => {
  return async (
    methodParam?: {
      url?: UrlOptions;
      body?: BodyOptions;
      requestHeaders?: HeadersOptions;
    },
    options?: ClientOptions
  ) => {
    let methodParamBody: BodyInit | undefined = undefined;
    let methodParamContentType: ContentType | undefined = undefined;

    if (methodParam?.body?.json) {
      methodParamContentType = "application/json";
      methodParamBody = JSON.stringify(methodParam.body.json);
    }

    const methodParamHeaders = methodParam?.requestHeaders?.headers as
      | Record<string, string>
      | undefined;
    const methodParamCookies = methodParam?.requestHeaders?.cookies as
      | Record<string, string>
      | undefined;

    const urlObj = createUrl([...paths], params, dynamicKeys)(methodParam?.url);
    const method = key.replace(/^\$/, "").toUpperCase();

    const customFetch = options?.fetch ?? defaultOptions.fetch ?? fetch;

    const defaultInit = defaultOptions.init ?? {};
    const innerInit = options?.init ?? {};

    const defaultHeaders = normalizeHeaders(
      defaultInit.headers ?? defaultInit.headersInit
    );
    const innerHeaders = normalizeHeaders(
      methodParamHeaders ?? innerInit.headers ?? innerInit.headersInit
    );
    const mergedHeaders: Record<string, string> = {
      ...defaultHeaders,
      ...innerHeaders,
    };

    if (methodParamContentType) {
      mergedHeaders["content-type"] = methodParamContentType;
    }

    if (methodParamCookies) {
      mergedHeaders["cookie"] = Object.entries(methodParamCookies)
        .map(([key, value]) => `${key}=${value}`)
        .join("; ");
    }

    const {
      headers: _defHeaders,
      headersInit: _defHeadersInit,
      ...defaultInitWithoutHeaders
    } = defaultInit;
    const {
      headers: _innHeaders,
      headersInit: _innHeadersInit,
      ...innerInitWithoutHeaders
    } = innerInit;

    const mergedInit: TypedRequestInit = deepMerge(
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
