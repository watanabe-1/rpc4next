import { createRpcValidationErrorHandler, defineRpcErrors } from "rpc4next/server";
import type { InputTarget, RouteOnError, RouteValidationErrorHandler } from "rpc4next/server";

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
}) satisfies RouteOnError<typeof appRpcErrors>;

export const routeOnValidationError = createRpcValidationErrorHandler<
  InputTarget,
  typeof appRpcErrors
>() satisfies RouteValidationErrorHandler<typeof appRpcErrors>;

export const pageOnError = () => "page-helper-error";
