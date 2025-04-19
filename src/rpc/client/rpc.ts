/*!
 * Inspired by the design of Hono (https://github.com/honojs/hono)
 * and pathpida (https://github.com/aspida/pathpida)
 * particularly their routing structures and developer experience.
 */

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
      const pathKey = paths.at(-1);
      const paramKey = dynamicKeys.at(-1);

      if (value === undefined) {
        throw new Error(
          `An argument is required when calling the function for paramKey: ${paramKey}`
        );
      }

      if (pathKey && paramKey && isDynamic(pathKey)) {
        // Treat as a dynamic parameter
        return createRpcProxy(
          options,
          [...paths],
          { ...params, [paramKey]: value },
          dynamicKeys
        );
      }

      throw new Error(
        `paramKey: ${pathKey} is not a dynamic parameter and cannot be called as a function`
      );
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
          return httpMethod(key, [...paths], params, dynamicKeys, {
            ...options,
          });
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

/**
 * Creates an RPC client proxy for making HTTP requests with a strongly typed API.
 *
 * @template T - The type defining the RPC endpoint structure.
 * @param baseUrl - The base URL for the RPC client. This URL will be used as the root for all generated endpoint URLs.
 * @param options - (Optional) Client options to customize the behavior of the RPC client. These options may include a custom fetch function and default request initialization options.
 * @returns An object that enables you to dynamically build endpoint URLs and execute HTTP requests (such as GET, POST, DELETE, etc.) with full type support.
 *
 * @example
 * ```ts
 * import { createRpcClient } from "./rpc";
 * import type { PathStructure } from "./types";
 *
 * // Create an RPC client with a base URL
 * const client = createRpcClient<PathStructure>("http://localhost:3000");
 *
 * // Generate a URL for a dynamic endpoint
 * const urlResult = client.fuga._foo("test").$url();
 * console.log(urlResult.path);         // "http://localhost:3000/fuga/test"
 * console.log(urlResult.relativePath);   // "/fuga/test"
 * console.log(urlResult.pathname);       // "/fuga/[foo]"
 * console.log(urlResult.params);         // { foo: "test" }
 *
 * // Execute a GET request on an endpoint
 * const response = await client.api.hoge._foo("test").$get();
 * console.log(await response.json());    // Expected response: { method: "get" }
 * ```
 *
 * The above example demonstrates how to generate URLs with dynamic segments and how to execute HTTP requests.
 */
export const createRpcClient = <T extends object>(
  baseUrl: string,
  options: ClientOptions = {}
) => createRpcProxy<DynamicPathProxyAsFunction<T>>(options, [baseUrl]);

/**
 * Creates an RPC helper proxy for dynamic path matching based on a given endpoint structure.
 *
 * @template T - The type defining the RPC endpoint structure.
 *
 * @returns  An object that provides dynamic RPC helper methods for the defined endpoints.
 *
 * @example
 * ```ts
 * // Create the RPC helper
 * const rpcHelper = createRpcHelper<PathStructure>();
 *
 * // Use the $match method to extract dynamic parameters from a URL path
 * const match = rpcHelper.fuga._foo.$match("/fuga/test");
 * // Expected output: { foo: "test" }
 *
 * // If the path does not match, it returns null
 * const noMatch = rpcHelper.fuga._foo.$match("/hoge/test");
 * // Expected output: null
 * ```
 */
export const createRpcHelper = <T extends object>() =>
  createRpcProxy<DynamicPathProxyAsProperty<T>>({}, ["/"]);
