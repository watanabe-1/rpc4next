import { httpMethod } from "./http-method";
import { matchPath } from "./match";
import { createUrl } from "./url";
import { isDynamic, isHttpMethod } from "./utils";
import type { FuncParams, DynamicPathProxy } from "./types";

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
        // Treat as a dynamic parameter
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
          return matchPath([...paths], dynamicKeys);
        }

        if (isHttpMethod(key)) {
          return httpMethod(key, [...paths], params, dynamicKeys);
        }

        if (isDynamic(key)) {
          // Treat as a dynamic parameter
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
