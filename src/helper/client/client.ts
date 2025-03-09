import { HTTP_METHOD_KEYS } from "./constants";
import {
  DYNAMIC_PREFIX,
  CATCH_ALL_PREFIX,
  OPTIONAL_CATCH_ALL_PREFIX,
} from "../../lib/constants";
import type {
  HttpMethodKey,
  UrlOptions,
  FuncParams,
  UrlResult,
  DynamicPathProxy,
  FetcherOptions,
} from "./types";

const isDynamic = (key: string) => key.startsWith(DYNAMIC_PREFIX);
const isCatchAllOrOptional = (key: string) =>
  key.startsWith(CATCH_ALL_PREFIX) || key.startsWith(OPTIONAL_CATCH_ALL_PREFIX);

const httpMethods: Set<HttpMethodKey> = new Set(HTTP_METHOD_KEYS);

const isHttpMethod = (value: string): value is HttpMethodKey =>
  httpMethods.has(value as HttpMethodKey);

const buildUrlSuffix = (url?: UrlOptions) => {
  if (!url) return "";
  const query = url.query
    ? "?" + new URLSearchParams(url.query as Record<string, string>).toString()
    : "";
  const hash = url.hash ? `#${url.hash}` : "";

  return query + hash;
};

const replaceDynamicSegments = (
  basePath: string,
  replacements: {
    optionalCatchAll: string;
    catchAll: string;
    dynamic: string;
  }
): string =>
  basePath
    // optionalCatchAll
    .replace(/\/_{5}(\w+)/g, replacements.optionalCatchAll)
    // catchAll
    .replace(/\/_{3}(\w+)/g, replacements.catchAll)
    // dynamic
    .replace(/\/_(\w+)/g, replacements.dynamic);

const createUrl = (
  paths: string[],
  params: FuncParams,
  dynamicKeys: string[]
) => {
  const baseUrl = paths.shift();
  const basePath = paths.join("/");

  const dynamicPath = dynamicKeys.reduce((acc, key) => {
    const param = params[key];

    if (Array.isArray(param)) {
      return acc.replace(
        `/${key}`,
        `/${param.map(encodeURIComponent).join("/")}`
      );
    }

    if (param === undefined) {
      return acc.replace(`/${key}`, "");
    }

    return acc.replace(`/${key}`, `/${encodeURIComponent(param)}`);
  }, basePath);

  return (url?: UrlOptions) => {
    const relativePath = `/${dynamicPath}${buildUrlSuffix(url)}`;
    const pathname = replaceDynamicSegments(basePath, {
      optionalCatchAll: "/[[...$1]]",
      catchAll: "/[...$1]",
      dynamic: "/[$1]",
    });

    return {
      pathname,
      params,
      path: `${baseUrl}${relativePath}`,
      relativePath,
    } as UrlResult;
  };
};

const createRpcProxy = <T extends object>(
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
