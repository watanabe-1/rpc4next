import type { ProcedureOnError, ProcedureValidationErrorHandler } from "rpc4next/server";

export const getErrorMessage = (error: unknown) =>
  error instanceof Error ? error.message : String(error);

export const getIssuePath = (path: readonly (PropertyKey | { key: PropertyKey })[] | undefined) =>
  path?.map((segment) => String(typeof segment === "object" ? segment.key : segment)) ?? [];

export const routeOnError = ((error, { response }) => {
  console.error("[rpc4next] Unexpected procedure error", {
    message: getErrorMessage(error),
    error,
  });

  return response.error("INTERNAL_SERVER_ERROR", {
    message: "Internal server error",
  });
}) satisfies ProcedureOnError;

export const routeOnValidationError = (({ issues, response, target }) =>
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

export const pageOnError = () => "page-helper-error";
