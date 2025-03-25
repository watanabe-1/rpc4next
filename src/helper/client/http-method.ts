import { createUrl } from "./url";
import { deepMerge } from "./utils";
import type {
  FuncParams,
  UrlOptions,
  ClientOptions,
  TypedRequestInit,
} from "./types";

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
    const mergedInit: TypedRequestInit = deepMerge(defaultInit, innerInit);
    mergedInit.method = method;

    const response = await customFetch(urlObj.path, mergedInit);

    return response;
  };
};
