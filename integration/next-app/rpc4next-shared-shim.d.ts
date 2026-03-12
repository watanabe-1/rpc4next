declare module "rpc4next-shared" {
  export const HTTP_METHODS: readonly [
    "GET",
    "HEAD",
    "OPTIONS",
    "POST",
    "PUT",
    "DELETE",
    "PATCH",
  ];

  export const OPTIONAL_CATCH_ALL_PREFIX: "_____";
  export const CATCH_ALL_PREFIX: "___";
  export const DYNAMIC_PREFIX: "_";
  export const HTTP_METHODS_EXCLUDE_OPTIONS: readonly [
    "GET",
    "HEAD",
    "POST",
    "PUT",
    "DELETE",
    "PATCH",
  ];
  export const HTTP_METHOD_FUNC_KEYS: readonly [
    "$get",
    "$head",
    "$post",
    "$put",
    "$delete",
    "$patch",
  ];

  export type HttpMethod = (typeof HTTP_METHODS)[number];
}
