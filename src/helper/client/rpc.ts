import { createUrl, replaceDynamicSegments } from "./url";
import { isDynamic, isCatchAllOrOptional, isHttpMethod } from "./utils";
import type {
  FuncParams,
  UrlOptions,
  DynamicPathProxy,
  FetcherOptions,
} from "./types";

export const createRpcProxy = <T extends object>(
  paths: string[] = [],
  params: FuncParams = {},
  dynamicKeys: string[] = []
): DynamicPathProxy<T> => {
  const proxy: unknown = new Proxy(
    (value?: string | number) => {
      if (value === undefined) {
        return createRpcProxy([...paths], params, dynamicKeys);
      }

      const newKey = paths.at(-1) ?? "";
      if (isDynamic(newKey)) {
        // 動的パラメータとして扱う
        return createRpcProxy(
          [...paths],
          { ...params, [dynamicKeys.at(-1) ?? ""]: value },
          dynamicKeys
        );
      }

      return createRpcProxy([...paths], params, dynamicKeys);
    },
    {
      get: (_, key: string) => {
        if (key === "$url") {
          return createUrl([...paths], params, dynamicKeys);
        }

        if (key === "$match") {
          return (path: string) => {
            const basePath = `/${paths.slice(1).join("/")}`;
            const regexPattern = replaceDynamicSegments(basePath, {
              optionalCatchAll: "/(.*)?",
              catchAll: "/([^/]+(?:/[^/]+)*)",
              dynamic: "/([^/]+)",
            });
            const match = new RegExp(`^${regexPattern}$`).exec(path);

            if (!match) return null;

            return dynamicKeys.reduce((acc, key, index) => {
              const paramKey = key.replace(/^_+/, "");
              const matchValue = match[index + 1];
              const paramValue = isCatchAllOrOptional(key)
                ? matchValue?.split("/")
                : matchValue;

              return {
                ...acc,
                [paramKey]: paramValue,
              };
            }, {});
          };
        }

        if (isHttpMethod(key)) {
          return async (url?: UrlOptions, options?: FetcherOptions) => {
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
        }

        if (isDynamic(key)) {
          // 動的パラメータとして扱う
          return createRpcProxy([...paths, key], params, [...dynamicKeys, key]);
        }

        return createRpcProxy([...paths, key], params, dynamicKeys);
      },
    }
  );

  return proxy as DynamicPathProxy<T>;
};

export const createRpcClient = <T extends object>(baseUrl: string) =>
  createRpcProxy<T>([baseUrl]);
