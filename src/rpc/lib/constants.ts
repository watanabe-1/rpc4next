import { HTTP_METHODS } from "next/dist/server/web/http";

export const OPTIONAL_CATCH_ALL_PREFIX = "_____";
export const CATCH_ALL_PREFIX = "___";
export const DYNAMIC_PREFIX = "_";

export const HTTP_METHODS_EXCLUDE_OPTIONS = HTTP_METHODS.filter(
  (method) => method !== "OPTIONS"
);

export const HTTP_METHOD_FUNC_KEYS = HTTP_METHODS_EXCLUDE_OPTIONS.map(
  (method) => `$${method.toLowerCase()}` as `$${Lowercase<typeof method>}`
);
