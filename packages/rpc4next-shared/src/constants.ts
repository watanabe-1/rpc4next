/** HTTP methods recognized by rpc4next route scanning and client generation. */
export const HTTP_METHODS = ["GET", "HEAD", "OPTIONS", "POST", "PUT", "DELETE", "PATCH"] as const;

/** Generated segment prefix for optional catch-all route params. */
export const OPTIONAL_CATCH_ALL_PREFIX = "_____";
/** Generated segment prefix for catch-all route params. */
export const CATCH_ALL_PREFIX = "___";
/** Generated segment prefix for dynamic route params. */
export const DYNAMIC_PREFIX = "_";

/** HTTP methods that can be emitted as callable client methods. */
export const HTTP_METHODS_EXCLUDE_OPTIONS = HTTP_METHODS.filter((method) => method !== "OPTIONS");

/** Generated client method keys such as `$get` and `$post`. */
export const HTTP_METHOD_FUNC_KEYS = HTTP_METHODS_EXCLUDE_OPTIONS.map(
  (method) => `$${method.toLowerCase()}` as `$${Lowercase<typeof method>}`,
);
