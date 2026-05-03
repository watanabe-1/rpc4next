import { isHttpMethod } from "./client-utils";
import { httpMethod } from "./http-method";
import { makeCreateRpc } from "./rpc";
import type { DynamicPathProxyAsFunction, RpcClientOptions } from "./types";
import { createUrl } from "./url";

/**
 * Creates an RPC client proxy for making HTTP requests with a strongly typed API.
 *
 * @example
 *   ```ts
 *   import { createRpcClient } from "./rpc";
 *   import type { PathStructure } from "./types";
 *
 *   // Create an RPC client with a base URL
 *   const client = createRpcClient<PathStructure>("http://localhost:3000");
 *
 *   // Generate a URL for a dynamic route
 *   const urlResult = client.fuga._foo("test").$url();
 *   console.log(urlResult.path); // "http://localhost:3000/fuga/test"
 *   console.log(urlResult.relativePath); // "/fuga/test"
 *   console.log(urlResult.pathname); // "/fuga/[foo]"
 *   console.log(urlResult.params); // { foo: "test" }
 *
 *   // Execute a GET request on a route
 *   const response = await client.api.hoge._foo("test").$get();
 *   console.log(await response.json()); // Expected response: { method: "get" }
 *   ```
 *
 *   The above example demonstrates how to generate URLs with dynamic segments and how to execute HTTP requests.
 *
 * @template T - The type defining the RPC path structure.
 * @param baseUrl - The base URL for the RPC client. This URL will be used as the root for all
 *   generated client URLs.
 * @param options - (Optional) Client options to customize the behavior of the RPC client. These
 *   options may include a custom fetch function and default request initialization options.
 * @returns An object that enables you to dynamically build client URLs and execute HTTP requests
 *   (such as GET, POST, DELETE, etc.) with full type support.
 */
export const createRpcClient = makeCreateRpc((key, { paths, params, dynamicKeys, options }) => {
  if (key === "$url") {
    return createUrl([...paths], params, dynamicKeys);
  }
  if (isHttpMethod(key)) {
    return httpMethod(key, [...paths], params, dynamicKeys, options);
  }

  return undefined;
}) as <T extends object>(
  baseUrl: string,
  options?: RpcClientOptions,
) => DynamicPathProxyAsFunction<T>;
