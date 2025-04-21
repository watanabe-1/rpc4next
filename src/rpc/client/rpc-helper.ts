import { matchPath } from "./match";
import { makeCreateRpc } from "./rpc";
import type { DynamicPathProxyAsProperty } from "./types";

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
export const createRpcHelper = makeCreateRpc((key, { paths, dynamicKeys }) => {
  if (key === "$match") {
    return matchPath([...paths], dynamicKeys);
  }

  return undefined;
}) as <T extends object>() => DynamicPathProxyAsProperty<T>;
