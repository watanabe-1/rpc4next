import { isDynamic, isOptionalCatchAll } from "./client-utils";
import type { PathParamsInput, RpcClientOptions, RpcProxyHandler } from "./types";

type ProxyState = {
  parent: ProxyState | undefined;
  segment: string;
  dynamicKey: string | undefined;
  params: PathParamsInput;
  paths: string[] | undefined;
  dynamicKeys: string[] | undefined;
};

const materializePaths = (state: ProxyState): string[] => {
  if (state.paths) {
    return state.paths;
  }

  const segments: string[] = [];
  for (let current: ProxyState | undefined = state; current; current = current.parent) {
    segments.push(current.segment);
  }

  state.paths = segments.reverse();

  return state.paths;
};

const materializeDynamicKeys = (state: ProxyState): string[] => {
  if (state.dynamicKeys) {
    return state.dynamicKeys;
  }

  const keys: string[] = [];
  for (let current: ProxyState | undefined = state; current; current = current.parent) {
    if (current.dynamicKey) {
      keys.push(current.dynamicKey);
    }
  }

  state.dynamicKeys = keys.reverse();

  return state.dynamicKeys;
};

const extendState = (
  state: ProxyState,
  segment: string,
  params: PathParamsInput = state.params,
): ProxyState => ({
  parent: state,
  segment,
  dynamicKey: isDynamic(segment) ? segment : undefined,
  params,
  paths: undefined,
  dynamicKeys: undefined,
});

const createProxy = <T>(
  handler: RpcProxyHandler,
  options: RpcClientOptions,
  state: ProxyState,
): T => {
  // We keep a callable target but route all calls through the `apply` trap.
  /* c8 ignore start */ // intentionally unreachable (apply trap intercepts calls)
  const target = function noop() {}; // required to make the proxy callable
  /* c8 ignore stop */

  const proxy = new Proxy(target, {
    // Calling the proxy supplies a value for the most recent dynamic segment.
    apply(_t, _thisArg, argArray: [value?: string | number | string[] | undefined, ...unknown[]]) {
      const value = argArray[0];
      const lastPath = state.segment;
      const lastKey = state.dynamicKey;

      if (!lastPath || !isDynamic(lastPath)) {
        // Guard: someone called the proxy when the tail isn't dynamic.
        throw new Error(`Cannot apply a value: "${lastPath ?? ""}" is not a dynamic segment.`);
      }
      if (value === undefined && !isOptionalCatchAll(lastPath)) {
        const label = lastKey ?? lastPath;
        throw new Error(`Missing value for dynamic parameter: ${String(label)}`);
      }

      // Note: we keep the dynamic placeholder in `paths`.
      // The `handler` should substitute using `params`.
      return createProxy(handler, options, {
        ...state,
        params: { ...state.params, [lastKey ?? lastPath]: value },
      });
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
      const handled = handler(k, {
        get paths() {
          return materializePaths(state);
        },
        params: state.params,
        get dynamicKeys() {
          return materializeDynamicKeys(state);
        },
        options,
      });
      if (handled !== undefined) {
        return handled as T;
      }

      // Extend the chain with either a dynamic or static segment.
      return createProxy(handler, options, extendState(state, k));
    },
  });

  return proxy as unknown as T;
};

export const makeCreateRpc =
  (handler: RpcProxyHandler) =>
  <T extends object>(base: string = "/", options: RpcClientOptions = {}) =>
    createProxy<T>(handler, options, {
      parent: undefined,
      segment: base,
      dynamicKey: undefined,
      params: {},
      paths: undefined,
      dynamicKeys: undefined,
    });
