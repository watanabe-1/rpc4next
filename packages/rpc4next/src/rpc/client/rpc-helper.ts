import { isStandardSchemaV1 } from "../server/standard-schema";
import { matchPath } from "./match";
import { makeCreateRpc } from "./rpc";
import type {
  DynamicPathProxyAsProperty,
  RpcGeneratedPathStructure,
  RpcMatchResult,
  RpcMatchSchemas,
} from "./types";

export type { StandardSchemaV1 } from "../server/standard-schema";
export type { RpcMatchResult, RpcMatchSchemas } from "./types";

/**
 * Creates an RPC helper proxy for matching paths and validating extracted params and query. Both
 * Standard Schema contracts are required, including for empty params or query objects. Share the
 * same schema objects with procedure declarations in a client-safe module. `$match()` resolves to
 * `null` for a path mismatch or schema validation issues, and returns validated outputs (including
 * defaults and transformations) on success. Schema exceptions reject the promise. The decoded hash
 * is returned unchanged.
 *
 * @example
 *   ~~~ts
 *   import { createRpcHelper } from "rpc4next/client/helper";
 *   import { z } from "zod";
 *   import type { PathStructure } from "./generated/rpc";
 *
 *   const rpcHelper = createRpcHelper<PathStructure>();
 *   const schemas = { params: z.object({ id: z.string() }), query: z.object({}) };
 *   const match = await rpcHelper.photo._id.$match("/photo/42", schemas);
 *   console.log(match?.params.id); // "42"
 *
 *   const noMatch = await rpcHelper.photo._id.$match("/feed", schemas);
 *   console.log(noMatch); // null
 *   ~~~
 *
 * @template T - The type defining the RPC endpoint structure.
 * @returns An object that provides dynamic RPC helper methods for the defined endpoints.
 */
export const createRpcHelper = makeCreateRpc((key, context) => {
  if (key === "$match") {
    const match = matchPath(context.paths, context.dynamicKeys);

    return async <TSchemas extends RpcMatchSchemas>(
      path: string,
      schemas: TSchemas,
    ): Promise<RpcMatchResult<TSchemas> | null> => {
      if (!isStandardSchemaV1(schemas?.params) || !isStandardSchemaV1(schemas?.query)) {
        throw new TypeError("$match requires Standard Schema contracts for both params and query.");
      }

      const result = match(path);
      if (!result) return null;

      const params = await schemas.params["~standard"].validate(result.params);
      if (params.issues) return null;

      const query = await schemas.query["~standard"].validate(result.query);
      if (query.issues) return null;

      return {
        params: params.value,
        query: query.value,
        hash: result.hash,
      } as RpcMatchResult<TSchemas>;
    };
  }

  return undefined;
}) as <T extends RpcGeneratedPathStructure>() => DynamicPathProxyAsProperty<T>;
