import { matchPath } from "./match";
import { makeCreateRpc } from "./rpc";
import type { DynamicPathProxyAsProperty, RpcGeneratedPathStructure } from "./types";

/**
 * Creates an RPC helper proxy for matching concrete paths against generated routes.
 *
 * @example
 *   ~~~ts
 *   import { createRpcHelper } from "rpc4next/client/helper";
 *   import type { PathStructure } from "./generated/rpc";
 *
 *   const rpcHelper = createRpcHelper<PathStructure>();
 *   const match = rpcHelper.photo._id.$match("/photo/42");
 *   console.log(match?.params.id); // "42"
 *
 *   const noMatch = rpcHelper.photo._id.$match("/feed");
 *   console.log(noMatch); // null
 *   ~~~
 *
 * @template T - The type defining the RPC endpoint structure.
 * @returns An object that provides dynamic RPC helper methods for the defined endpoints.
 */
export const createRpcHelper = makeCreateRpc((key, context) => {
  if (key === "$match") {
    return matchPath(context.paths, context.dynamicKeys);
  }

  return undefined;
}) as <T extends RpcGeneratedPathStructure>() => DynamicPathProxyAsProperty<T>;
