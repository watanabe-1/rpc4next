import type { HttpStatusCode } from "../lib/http-status-code-types";

/** HTTP status codes that rpc4next error envelopes may use. */
export type RpcErrorStatusCode = Extract<
  HttpStatusCode,
  | 400
  | 401
  | 402
  | 403
  | 404
  | 405
  | 406
  | 407
  | 408
  | 409
  | 410
  | 411
  | 412
  | 413
  | 414
  | 415
  | 416
  | 417
  | 418
  | 421
  | 422
  | 423
  | 424
  | 425
  | 426
  | 428
  | 429
  | 431
  | 451
  | 500
  | 501
  | 502
  | 503
  | 504
  | 505
  | 506
  | 507
  | 508
  | 510
  | 511
>;

/** Describes one application error code and the HTTP status it maps to. */
export type RpcErrorCatalogEntry<TStatus extends RpcErrorStatusCode = RpcErrorStatusCode> = {
  status: TStatus;
  message?: string;
};

/** Map of application error codes to their default HTTP status and message. */
export type RpcErrorCatalog = Record<string, RpcErrorCatalogEntry>;

const DEFAULT_RPC_ERROR_CATALOG = {
  BAD_REQUEST: { status: 400, message: "Bad request" },
  UNAUTHORIZED: { status: 401, message: "Unauthorized" },
  FORBIDDEN: { status: 403, message: "Forbidden" },
  NOT_FOUND: { status: 404, message: "Not found" },
  CONFLICT: { status: 409, message: "Conflict" },
  UNPROCESSABLE_CONTENT: { status: 422, message: "Unprocessable content" },
  TOO_MANY_REQUESTS: { status: 429, message: "Too many requests" },
  INTERNAL_SERVER_ERROR: { status: 500, message: "Internal server error" },
} as const satisfies RpcErrorCatalog;

/** Built-in rpc4next error catalog used when an app does not define its own codes. */
export type DefaultRpcErrorCatalog = typeof DEFAULT_RPC_ERROR_CATALOG;

/** String union of error codes from an rpc4next error catalog. */
export type RpcErrorCode<TCatalog extends RpcErrorCatalog = DefaultRpcErrorCatalog> = Extract<
  keyof TCatalog,
  string
>;

/** HTTP status mapped from a specific rpc4next error code. */
export type RpcErrorStatus<
  TCode extends string = RpcErrorCode,
  TCatalog extends RpcErrorCatalog = DefaultRpcErrorCatalog,
> = TCode extends keyof TCatalog ? TCatalog[TCode]["status"] : never;

/** Default catalog plus app-defined overrides returned by `defineRpcErrors(...)`. */
export type DefineRpcErrors<TCatalog extends RpcErrorCatalog> = Omit<
  DefaultRpcErrorCatalog,
  keyof TCatalog
> &
  TCatalog;

/** Built-in rpc4next error catalog. */
export const defaultRpcErrorCatalog = DEFAULT_RPC_ERROR_CATALOG;

/**
 * Merges app-specific error codes with the default rpc4next error catalog.
 *
 * Use the returned value with `createRouteProcedure({ errors, onError })` so `response.error(...)`
 * and generated client response unions know your custom codes and statuses.
 */
export const defineRpcErrors = <const TCatalog extends RpcErrorCatalog>(
  catalog: TCatalog,
): DefineRpcErrors<TCatalog> => {
  return {
    ...DEFAULT_RPC_ERROR_CATALOG,
    ...catalog,
  } as DefineRpcErrors<TCatalog>;
};

const getRpcErrorCatalogEntry = <
  TCatalog extends RpcErrorCatalog,
  TCode extends RpcErrorCode<TCatalog>,
>(
  catalog: TCatalog,
  code: TCode,
) => {
  return catalog[code];
};

/** JSON payload shape returned by `response.error(...)`. */
export interface RpcErrorEnvelope<TCode extends string = RpcErrorCode, TDetails = unknown> {
  error: {
    code: TCode;
    message: string;
    details?: TDetails;
  };
}

/** Optional message and typed details for `response.error(...)`. */
export interface RpcErrorResponseInit<TDetails = unknown> {
  message?: string;
  details?: TDetails;
}

/** Returns the HTTP status for a built-in rpc4next error code. */
export const getDefaultRpcErrorStatus = <TCode extends RpcErrorCode>(
  code: TCode,
): RpcErrorStatus<TCode> => {
  return DEFAULT_RPC_ERROR_CATALOG[code].status as RpcErrorStatus<TCode>;
};

/** Returns the HTTP status for an error code in the provided catalog. */
export const getRpcErrorStatus = <
  TCatalog extends RpcErrorCatalog,
  TCode extends RpcErrorCode<TCatalog>,
>(
  catalog: TCatalog,
  code: TCode,
): RpcErrorStatus<TCode, TCatalog> => {
  return getRpcErrorCatalogEntry(catalog, code).status as RpcErrorStatus<TCode, TCatalog>;
};

/** Creates a default-catalog rpc4next error envelope without creating a `Response`. */
export const createRpcErrorEnvelope = <TCode extends RpcErrorCode, TDetails = unknown>(
  code: TCode,
  init: RpcErrorResponseInit<TDetails> = {},
): RpcErrorEnvelope<TCode, TDetails> => {
  return {
    error: {
      code,
      message: init.message ?? DEFAULT_RPC_ERROR_CATALOG[code].message,
      ...(init.details === undefined ? {} : { details: init.details }),
    },
  };
};

/** Creates a catalog-aware rpc4next error envelope without creating a `Response`. */
export const createRpcErrorEnvelopeFromCatalog = <
  TCatalog extends RpcErrorCatalog,
  TCode extends RpcErrorCode<TCatalog>,
  TDetails = unknown,
>(
  catalog: TCatalog,
  code: TCode,
  init: RpcErrorResponseInit<TDetails> = {},
): RpcErrorEnvelope<TCode, TDetails> => {
  const entry = getRpcErrorCatalogEntry(catalog, code);

  return {
    error: {
      code,
      message: init.message ?? entry.message ?? code,
      ...(init.details === undefined ? {} : { details: init.details }),
    },
  };
};
