import type { HttpStatusCode } from "../lib/http-status-code-types";

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

export type RpcErrorCatalogEntry<TStatus extends RpcErrorStatusCode = RpcErrorStatusCode> = {
  status: TStatus;
  message?: string;
};

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

export type DefaultRpcErrorCatalog = typeof DEFAULT_RPC_ERROR_CATALOG;

export type RpcErrorCode<TCatalog extends RpcErrorCatalog = DefaultRpcErrorCatalog> = Extract<
  keyof TCatalog,
  string
>;

export type RpcErrorStatus<
  TCode extends string = RpcErrorCode,
  TCatalog extends RpcErrorCatalog = DefaultRpcErrorCatalog,
> = TCode extends keyof TCatalog ? TCatalog[TCode]["status"] : never;

export type DefineRpcErrors<TCatalog extends RpcErrorCatalog> = Omit<
  DefaultRpcErrorCatalog,
  keyof TCatalog
> &
  TCatalog;

export const defaultRpcErrorCatalog = DEFAULT_RPC_ERROR_CATALOG;

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

export interface RpcErrorEnvelope<TCode extends string = RpcErrorCode, TDetails = unknown> {
  error: {
    code: TCode;
    message: string;
    details?: TDetails;
  };
}

export interface RpcErrorResponseInit<TDetails = unknown> {
  message?: string;
  details?: TDetails;
}

export const getDefaultRpcErrorStatus = <TCode extends RpcErrorCode>(
  code: TCode,
): RpcErrorStatus<TCode> => {
  return DEFAULT_RPC_ERROR_CATALOG[code].status as RpcErrorStatus<TCode>;
};

export const getRpcErrorStatus = <
  TCatalog extends RpcErrorCatalog,
  TCode extends RpcErrorCode<TCatalog>,
>(
  catalog: TCatalog,
  code: TCode,
): RpcErrorStatus<TCode, TCatalog> => {
  return getRpcErrorCatalogEntry(catalog, code).status as RpcErrorStatus<TCode, TCatalog>;
};

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
