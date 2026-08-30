import { createRpcValidationErrorHandler, defineRpcErrors } from "rpc4next/server";
import type {
  ProcedureInputTarget,
  ProcedureOnError,
  ProcedureOnErrorResult,
  ProcedureValidationErrorHandler,
  ProcedureValidationErrorHandlerResult,
} from "rpc4next/server";

export const appRpcErrors = defineRpcErrors({
  PLAN_REQUIRED: { status: 402, message: "Plan required" },
});

export const getErrorMessage = (error: unknown) =>
  error instanceof Error ? error.message : String(error);

export const routeOnError = ((error, { response }) => {
  console.error("[rpc4next] Unexpected procedure error", {
    message: getErrorMessage(error),
    error,
  });

  return response.error("INTERNAL_SERVER_ERROR", {
    message: "Internal server error",
  });
}) satisfies ProcedureOnError<ProcedureOnErrorResult, typeof appRpcErrors>;

export const routeOnValidationError = createRpcValidationErrorHandler<
  ProcedureInputTarget,
  typeof appRpcErrors
>() satisfies ProcedureValidationErrorHandler<
  ProcedureInputTarget,
  unknown,
  ProcedureValidationErrorHandlerResult,
  typeof appRpcErrors
>;

export const pageOnError = () => "page-helper-error";
