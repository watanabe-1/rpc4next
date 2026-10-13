import type { HTTP_METHODS } from "./constants";

/** HTTP method names recognized by rpc4next. */
export type HttpMethod = (typeof HTTP_METHODS)[number];
