import {
  DYNAMIC_PREFIX,
  CATCH_ALL_PREFIX,
  OPTIONAL_CATCH_ALL_PREFIX,
  HTTP_METHOD_FUNC_KEYS,
} from "rpc4next-shared";
import type { HttpMethodFuncKey } from "./types";

/**
 * Returns true if the given key represents a dynamic segment.
 */
export const isDynamic = (key: string) => key.startsWith(DYNAMIC_PREFIX);

/**
 * Returns true if the key represents a catch-all or optional catch-all segment.
 */
export const isCatchAllOrOptional = (key: string) =>
  key.startsWith(CATCH_ALL_PREFIX) || key.startsWith(OPTIONAL_CATCH_ALL_PREFIX);

const httpMethods: Set<HttpMethodFuncKey> = new Set(HTTP_METHOD_FUNC_KEYS);

export const isHttpMethod = (value: string): value is HttpMethodFuncKey =>
  httpMethods.has(value as HttpMethodFuncKey);

const isPlainObject = (value: unknown): value is Record<string, unknown> => {
  return typeof value === "object" && value !== null && !Array.isArray(value);
};

export const deepMerge = <T extends object, U extends object>(
  target: T,
  source: U,
): T => {
  const result = { ...target } as T & U;

  for (const key in source) {
    if (Object.prototype.hasOwnProperty.call(source, key)) {
      const targetValue = (target as Record<string, unknown>)[key];
      const sourceValue = (source as Record<string, unknown>)[key];

      if (isPlainObject(targetValue) && isPlainObject(sourceValue)) {
        (result as Record<string, unknown>)[key] = deepMerge(
          targetValue,
          sourceValue,
        );
      } else {
        result[key as keyof (T & U)] = sourceValue as (T & U)[keyof (T & U)];
      }
    }
  }

  return result;
};
