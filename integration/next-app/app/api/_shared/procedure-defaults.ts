import {
  type ProcedureOnError,
  type ProcedureValidationErrorHandler,
  procedure,
} from "rpc4next/server";

const getErrorMessage = (error: unknown) =>
  error instanceof Error ? error.message : String(error);

const getIssuePath = (path: readonly (PropertyKey | { key: PropertyKey })[] | undefined) =>
  path?.map((segment) => String(typeof segment === "object" ? segment.key : segment)) ?? [];

const sharedOnError = ((error, { response }) => {
  if (error instanceof Response) {
    return error;
  }

  console.error("[rpc4next] Unexpected procedure error", {
    message: getErrorMessage(error),
    error,
  });

  return response.error("INTERNAL_SERVER_ERROR", {
    message: "Internal server error",
  });
}) satisfies ProcedureOnError;

const sharedOnValidationError = (({ issues, response, target }) =>
  response.error("BAD_REQUEST", {
    message: issues[0]?.message ?? "Validation failed.",
    details: {
      target,
      issues: issues.map(({ message, path }) => ({
        message,
        path: getIssuePath(path),
      })),
    },
  })) satisfies ProcedureValidationErrorHandler;

export const appProcedure = procedure.defaults({
  route: {
    onError: sharedOnError,
    onValidationError: sharedOnValidationError,
  },
});
