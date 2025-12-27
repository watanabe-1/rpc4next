declare module "rpc4next/lib/constants" {
  export {
    OPTIONAL_CATCH_ALL_PREFIX,
    CATCH_ALL_PREFIX,
    DYNAMIC_PREFIX,
    HTTP_METHODS_EXCLUDE_OPTIONS,
  } from "../rpc4next/src/rpc/lib/constants";
}

declare module "rpc4next/lib/types" {
  export type { HttpMethod } from "../rpc4next/src/rpc/lib/types";
}
