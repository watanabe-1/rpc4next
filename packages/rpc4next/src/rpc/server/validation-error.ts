import type {
  DefaultRpcErrorCatalog,
  RpcErrorCatalog,
  RpcErrorCatalogEntry,
  RpcErrorCode,
  RpcErrorEnvelope,
} from "./error";
import type {
  ProcedureInputTarget,
  ProcedureValidationErrorHandler,
  ProcedureValidationErrorContext,
} from "./procedure-types";
import type { TypedNextResponse } from "./types";

/** Sanitized validation issue returned by the default rpc4next validation handler. */
export type RpcValidationErrorIssue = {
  message: string;
  path: string[];
};

/** Details payload for a `BAD_REQUEST` validation error envelope. */
export type RpcValidationErrorDetails<TTarget extends ProcedureInputTarget = ProcedureInputTarget> =
  {
    target: TTarget;
    issues: RpcValidationErrorIssue[];
  };

/** Typed `400` response produced by `createRpcValidationErrorHandler()`. */
export type RpcValidationErrorResponse<
  TTarget extends ProcedureInputTarget = ProcedureInputTarget,
> = TypedNextResponse<
  RpcErrorEnvelope<"BAD_REQUEST", RpcValidationErrorDetails<TTarget>>,
  400,
  "application/json"
>;

/** Converts a Standard Schema issue path into a serializable string path. */
export const getRpcValidationIssuePath = (
  path: ProcedureValidationErrorContext["issues"][number]["path"],
) => path?.map((segment) => String(typeof segment === "object" ? segment.key : segment)) ?? [];

/**
 * Creates a route validation handler that returns a typed `BAD_REQUEST` envelope.
 *
 * Use it as the shared `onValidationError` for `createRouteProcedure(...)` when clients should
 * receive sanitized validation details in a consistent shape.
 */
export const createRpcValidationErrorHandler = <
  TTarget extends ProcedureInputTarget = ProcedureInputTarget,
  TErrorCatalog extends RpcErrorCatalog & {
    BAD_REQUEST: RpcErrorCatalogEntry<400>;
  } = DefaultRpcErrorCatalog,
>(): ProcedureValidationErrorHandler<
  TTarget,
  unknown,
  RpcValidationErrorResponse<TTarget>,
  TErrorCatalog
> =>
  (({ issues, response, target }) =>
    response.error("BAD_REQUEST" as RpcErrorCode<TErrorCatalog>, {
      message: issues[0]?.message ?? "Validation failed.",
      details: {
        target,
        issues: issues.map(({ message, path }) => ({
          message,
          path: getRpcValidationIssuePath(path),
        })),
      },
    })) as ProcedureValidationErrorHandler<
    TTarget,
    unknown,
    RpcValidationErrorResponse<TTarget>,
    TErrorCatalog
  >;
