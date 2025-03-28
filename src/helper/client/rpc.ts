// Inspired by Hono (https://github.com/honojs/hono)
// Some parts of this code are based on or adapted from the Hono project

import { httpMethod } from "./http-method";
import { matchPath } from "./match";
import { createUrl } from "./url";
import { isDynamic, isHttpMethod } from "./utils";
import type {
  FuncParams,
  DynamicPathProxyAsFunction,
  ClientOptions,
  DynamicPathProxyAsProperty,
} from "./types";

export const createRpcProxy = <T extends object>(
  options: ClientOptions,
  paths: string[] = [],
  params: FuncParams = {},
  dynamicKeys: string[] = []
) => {
  const proxy: unknown = new Proxy(
    (value?: string | number) => {
      if (value === undefined) {
        return createRpcProxy(options, [...paths], params, dynamicKeys);
      }

      const newKey = paths.at(-1) ?? "";
      if (isDynamic(newKey)) {
        // Treat as a dynamic parameter
        return createRpcProxy(
          options,
          [...paths],
          { ...params, [dynamicKeys.at(-1) ?? ""]: value },
          dynamicKeys
        );
      }

      return createRpcProxy(options, [...paths], params, dynamicKeys);
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
          return httpMethod(key, [...paths], params, dynamicKeys, options);
        }

        if (isDynamic(key)) {
          // Treat as a dynamic parameter
          return createRpcProxy(options, [...paths, key], params, [
            ...dynamicKeys,
            key,
          ]);
        }

        return createRpcProxy(options, [...paths, key], params, dynamicKeys);
      },
    }
  );

  return proxy as T;
};

export const createRpcClient = <T extends object>(
  baseUrl: string,
  options: ClientOptions = {}
) => createRpcProxy<DynamicPathProxyAsFunction<T>>(options, [baseUrl]);

export const createRpcHelper = <T extends object>() =>
  createRpcProxy<DynamicPathProxyAsProperty<T>>({}, ["/"]);
