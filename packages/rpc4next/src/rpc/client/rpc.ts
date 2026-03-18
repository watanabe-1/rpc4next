/*!
 * Inspired by the design of Hono (https://github.com/honojs/hono)
 * and pathpida (https://github.com/aspida/pathpida)
 * particularly their routing structures and developer experience.
 */

import { isDynamic, isOptionalCatchAll } from "./client-utils";
import type {
  PathParamsInput,
  RpcClientOptions,
  RpcProxyHandler,
} from "./types";

const createProxy = <T>(
  handler: RpcProxyHandler,
  options: RpcClientOptions,
  paths: string[],
  params: PathParamsInput,
  dynamicKeys: string[],
): T => {
  // We keep a callable target but route all calls through the `apply` trap.
  /* c8 ignore start */ // intentionally unreachable (apply trap intercepts calls)
  const target = function noop() {}; // required to make the proxy callable
  /* c8 ignore stop */

  const proxy = new Proxy(target, {
    // Calling the proxy supplies a value for the most recent dynamic segment.
    apply(_t, _thisArg, argArray: unknown[]) {
      const value = argArray[0] as string | number | undefined;
      const lastPath = paths[paths.length - 1];
      const lastKey = dynamicKeys[dynamicKeys.length - 1];

      if (!lastPath || !isDynamic(lastPath)) {
        // Guard: someone called the proxy when the tail isn't dynamic.
        throw new Error(
          `Cannot apply a value: "${lastPath ?? ""}" is not a dynamic segment.`,
        );
      }
      if (value === undefined && !isOptionalCatchAll(lastPath)) {
        const label = lastKey ?? lastPath;
        throw new Error(
          `Missing value for dynamic parameter: ${String(label)}`,
        );
      }

      // Note: we keep the dynamic placeholder in `paths`.
      // The `handler` should substitute using `params`.
      return createProxy(
        handler,
        options,
        paths,
        { ...params, [lastKey]: value },
        dynamicKeys,
      );
    },

    // Property access either:
    // 1) lets `handler` short-circuit and return something, or
    // 2) appends a dynamic or static path segment and returns another proxy.
    get(_t, key: string | symbol) {
      // Avoid Promise-thenable pitfalls and handle symbols gracefully.
      if (key === "then" || typeof key === "symbol") {
        // Returning undefined prevents accidental thenable behavior and
        // satisfies introspection (e.g., util.inspect).
        return undefined as unknown as T;
      }

      const k = String(key);

      // Give the handler a chance to produce a terminal value or a method.
      const handled = handler(k, { paths, params, dynamicKeys, options });
      if (handled !== undefined) {
        return handled as T;
      }

      // Extend the chain with either a dynamic or static segment.
      if (isDynamic(k)) {
        return createProxy(handler, options, [...paths, k], params, [
          ...dynamicKeys,
          k,
        ]);
      }

      return createProxy(handler, options, [...paths, k], params, dynamicKeys);
    },
  });

  return proxy as unknown as T;
};

export const makeCreateRpc =
  (handler: RpcProxyHandler) =>
  <T extends object>(base: string = "/", options: RpcClientOptions = {}) =>
    createProxy<T>(handler, options, [base], {}, []);
