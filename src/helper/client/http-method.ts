import { createUrl } from "./url";
import type { FuncParams, UrlOptions, FetcherOptions } from "./types";

export const callHttpMethod = async (
  key: string,
  paths: string[],
  params: FuncParams,
  dynamicKeys: string[],
  url?: UrlOptions,
  options?: FetcherOptions
) => {
  const urlObj = createUrl([...paths], params, dynamicKeys)(url);
  const method = key.replace(/^\$/, "").toUpperCase();

  const response = await fetch(urlObj.path, {
    method: method,
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
