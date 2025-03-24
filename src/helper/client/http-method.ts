import { createUrl } from "./url";
import type { FuncParams, UrlOptions, FetcherOptions } from "./types";

export const httpMethod = (
  key: string,
  paths: string[],
  params: FuncParams,
  dynamicKeys: string[]
) => {
  return async (url?: UrlOptions, options?: FetcherOptions) => {
    const urlObj = createUrl([...paths], params, dynamicKeys)(url);
    const method = key.replace(/^\$/, "").toUpperCase();

    const response = await fetch(urlObj.path, {
      method,
      next: options?.next,
      headers: {
        "Content-Type": "application/json",
        ...options?.headers,
      },
      body: options?.body ? JSON.stringify(options.body) : undefined,
      credentials: "include",
    });

    return response;
  };
};
