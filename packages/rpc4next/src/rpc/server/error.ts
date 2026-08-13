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

export type RpcErrorStatus<TCode extends RpcErrorCode = RpcErrorCode> = TCode extends "BAD_REQUEST"
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

export interface RpcErrorEnvelope<TCode extends RpcErrorCode = RpcErrorCode, TDetails = unknown> {
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
  return DEFAULT_RPC_ERROR_STATUS[code] as RpcErrorStatus<TCode>;
};

export const createRpcErrorEnvelope = <TCode extends RpcErrorCode, TDetails = unknown>(
  code: TCode,
  init: RpcErrorResponseInit<TDetails> = {},
): RpcErrorEnvelope<TCode, TDetails> => {
  return {
    error: {
      code,
      message: init.message ?? DEFAULT_RPC_ERROR_MESSAGES[code],
      ...(init.details === undefined ? {} : { details: init.details }),
    },
  };
};
