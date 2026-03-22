export type RpcErrorCode =
  | "BAD_REQUEST"
  | "UNAUTHORIZED"
  | "FORBIDDEN"
  | "NOT_FOUND"
  | "CONFLICT"
  | "UNPROCESSABLE_CONTENT"
  | "TOO_MANY_REQUESTS"
  | "INTERNAL_SERVER_ERROR";

type RpcErrorMessageMap = Record<RpcErrorCode, string>;

const DEFAULT_RPC_ERROR_MESSAGES: RpcErrorMessageMap = {
  BAD_REQUEST: "Bad request",
  UNAUTHORIZED: "Unauthorized",
  FORBIDDEN: "Forbidden",
  NOT_FOUND: "Not found",
  CONFLICT: "Conflict",
  UNPROCESSABLE_CONTENT: "Unprocessable content",
  TOO_MANY_REQUESTS: "Too many requests",
  INTERNAL_SERVER_ERROR: "Internal server error",
};

const DEFAULT_RPC_ERROR_STATUS: Record<RpcErrorCode, number> = {
  BAD_REQUEST: 400,
  UNAUTHORIZED: 401,
  FORBIDDEN: 403,
  NOT_FOUND: 404,
  CONFLICT: 409,
  UNPROCESSABLE_CONTENT: 422,
  TOO_MANY_REQUESTS: 429,
  INTERNAL_SERVER_ERROR: 500,
};

export type RpcErrorStatus<TCode extends RpcErrorCode = RpcErrorCode> =
  TCode extends "BAD_REQUEST"
    ? 400
    : TCode extends "UNAUTHORIZED"
      ? 401
      : TCode extends "FORBIDDEN"
        ? 403
        : TCode extends "NOT_FOUND"
          ? 404
          : TCode extends "CONFLICT"
            ? 409
            : TCode extends "UNPROCESSABLE_CONTENT"
              ? 422
              : TCode extends "TOO_MANY_REQUESTS"
                ? 429
                : TCode extends "INTERNAL_SERVER_ERROR"
                  ? 500
                  : never;

export interface RpcErrorEnvelope<
  TCode extends RpcErrorCode = RpcErrorCode,
  TDetails = unknown,
> {
  error: {
    code: TCode;
    message: string;
    details?: TDetails;
  };
}

export interface RpcErrorInit<
  TCode extends RpcErrorCode = RpcErrorCode,
  TDetails = unknown,
> {
  message?: string;
  details?: TDetails;
  status?: RpcErrorStatus<TCode>;
  cause?: unknown;
  code?: TCode;
}

export const getDefaultRpcErrorStatus = <TCode extends RpcErrorCode>(
  code: TCode,
): RpcErrorStatus<TCode> => {
  return DEFAULT_RPC_ERROR_STATUS[code] as RpcErrorStatus<TCode>;
};

export class RpcError<
  TCode extends RpcErrorCode = RpcErrorCode,
  TDetails = unknown,
> extends Error {
  readonly code: TCode;
  readonly details: TDetails | undefined;
  readonly status: RpcErrorStatus<TCode>;

  constructor(code: TCode, init: RpcErrorInit<TCode, TDetails> = {}) {
    super(init.message ?? DEFAULT_RPC_ERROR_MESSAGES[code], {
      cause: init.cause,
    });

    this.name = "RpcError";
    this.code = init.code ?? code;
    this.details = init.details;
    this.status = (init.status ??
      getDefaultRpcErrorStatus(code)) as RpcErrorStatus<TCode>;
  }

  toJSON(): RpcErrorEnvelope<TCode, TDetails> {
    return createRpcErrorEnvelope(this);
  }
}

export const rpcError = <TCode extends RpcErrorCode, TDetails = unknown>(
  code: TCode,
  init?: RpcErrorInit<TCode, TDetails>,
) => new RpcError(code, init);

export const isRpcError = (value: unknown): value is RpcError => {
  return value instanceof RpcError;
};

export const createRpcErrorEnvelope = <
  TCode extends RpcErrorCode,
  TDetails = unknown,
>(
  error:
    | RpcError<TCode, TDetails>
    | {
        code: TCode;
        message: string;
        details?: TDetails;
      },
): RpcErrorEnvelope<TCode, TDetails> => {
  return {
    error: {
      code: error.code,
      message: error.message,
      ...(error.details === undefined ? {} : { details: error.details }),
    },
  };
};
