import { httpMethod } from "./http-method";
import { makeCreateRpc } from "./rpc";
import { createUrl } from "./url";
import { isHttpMethod } from "./utils";
import type { ClientOptions, DynamicPathProxyAsFunction } from "./types";

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
export const createRpcClient = makeCreateRpc(
  (key, { paths, params, dynamicKeys, options }) => {
    if (key === "$url") {
      return createUrl([...paths], params, dynamicKeys);
    }
    if (isHttpMethod(key)) {
      return httpMethod(key, [...paths], params, dynamicKeys, options);
    }

    return undefined;
  }
) as <T extends object>(
  baseUrl: string,
  options?: ClientOptions
) => DynamicPathProxyAsFunction<T>;
