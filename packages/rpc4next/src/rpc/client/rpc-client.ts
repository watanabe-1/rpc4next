import { isHttpMethod } from "./client-utils";
import { httpMethod } from "./http-method";
import { makeCreateRpc } from "./rpc";
import type {
  DynamicPathProxyAsFunction,
  RpcClientCreationOptions,
  RpcClientOptions,
  RpcGeneratedPathStructure,
} from "./types";
import { createUrl } from "./url";

/**
 * Creates a generated RPC client for fetch-like calls and typed URL generation.
 *
 * Dynamic path values and catch-all elements cannot be empty, `.` or `..`. URL construction throws
 * for these values; validate user input before accessing `$url` or an HTTP method. Optional
 * catch-all parameters can be omitted or passed as an empty array.
 *
 * @example
 *   ~~~ts
 *   import { createRpcClient } from "rpc4next/client";
 *   import type { PathStructure } from "./generated/rpc";
 *
 *   const rpc = createRpcClient<PathStructure>("");
 *
 *   // Generate a URL for a dynamic route
 *   const url = rpc.photo._id("42").$url();
 *   console.log(url.relativePath); // "/photo/42"
 *
 *   // Execute a GET request on a route
 *   const response = await rpc.api.users._userId("123").$get();
 *   console.log(await response.json());
 *   ~~~
 *
 *   Cookies are managed by the transport by default. Use `cookieMode: "explicit"` only for
 *   server-side requests that supply cookie values as arguments; browser requests then throw.
 *
 * @template T - The type defining the RPC path structure.
 * @param baseUrl - Base URL for generated paths. Use `""` for same-origin browser calls.
 * @param options - Optional custom `fetch` and default request init values.
 * @returns A proxy whose shape mirrors the generated App Router path tree.
 */
export const createRpcClient = makeCreateRpc((key, context) => {
  if (key === "$url") {
    return createUrl(context.paths, context.params, context.dynamicKeys);
  }
  if (isHttpMethod(key)) {
    return httpMethod(key, context.paths, context.params, context.dynamicKeys, context.options);
  }

  return undefined;
}) as {
  <T extends RpcGeneratedPathStructure>(
    baseUrl: string,
    options?: RpcClientOptions & { cookieMode?: "managed" },
  ): DynamicPathProxyAsFunction<T, "managed">;
  <T extends RpcGeneratedPathStructure>(
    baseUrl: string,
    options: RpcClientOptions & { cookieMode: "explicit" },
  ): DynamicPathProxyAsFunction<T, "explicit">;
  <T extends RpcGeneratedPathStructure>(
    baseUrl: string,
    options: RpcClientCreationOptions,
  ): DynamicPathProxyAsFunction<T, "explicit"> | DynamicPathProxyAsFunction<T, "managed">;
};
