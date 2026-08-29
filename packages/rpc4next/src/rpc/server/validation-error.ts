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

export type RpcValidationErrorIssue = {
  message: string;
  path: string[];
};

export type RpcValidationErrorDetails<TTarget extends ProcedureInputTarget = ProcedureInputTarget> =
  {
    target: TTarget;
    issues: RpcValidationErrorIssue[];
  };

export type RpcValidationErrorResponse<
  TTarget extends ProcedureInputTarget = ProcedureInputTarget,
> = TypedNextResponse<
  RpcErrorEnvelope<"BAD_REQUEST", RpcValidationErrorDetails<TTarget>>,
  400,
  "application/json"
>;

export const getRpcValidationIssuePath = (
  path: ProcedureValidationErrorContext["issues"][number]["path"],
) => path?.map((segment) => String(typeof segment === "object" ? segment.key : segment)) ?? [];

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
