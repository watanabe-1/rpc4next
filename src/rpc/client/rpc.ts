/*!
 * Inspired by the design of Hono (https://github.com/honojs/hono)
 * and pathpida (https://github.com/aspida/pathpida)
 * particularly their routing structures and developer experience.
 */

import { isDynamic } from "./client-utils";
import type { FuncParams, ClientOptions, RpcHandler } from "./types";

const createProxy = <T>(
  handler: RpcHandler,
  options: ClientOptions,
  paths: string[],
  params: FuncParams,
  dynamicKeys: string[]
): T => {
  return new Proxy(
    (value?: string | number) => {
      const lastPath = paths.at(-1)!;
      const lastKey = dynamicKeys.at(-1)!;
      if (value === undefined) {
        throw new Error(`Missing value for dynamic parameter: ${lastKey}`);
      }
      if (lastPath && lastKey && isDynamic(lastPath)) {
        return createProxy(
          handler,
          options,
          [...paths],
          { ...params, [lastKey]: value },
          dynamicKeys
        );
      }
      throw new Error(`${lastPath} is not dynamic`);
    },
    {
      get(_, key: string) {
        const handled = handler(key, { paths, params, dynamicKeys, options });
        if (handled !== undefined) {
          return handled;
        }

        if (isDynamic(key)) {
          return createProxy(handler, options, [...paths, key], params, [
            ...dynamicKeys,
            key,
          ]);
        }

        return createProxy(
          handler,
          options,
          [...paths, key],
          params,
          dynamicKeys
        );
      },
    }
  ) as T;
};

export const makeCreateRpc =
  (handler: RpcHandler) =>
  <T extends object>(base: string = "/", options: ClientOptions = {}) =>
    createProxy<T>(handler, options, [base], {}, []);
