import { type ProcedureOnError, procedure } from "rpc4next/server";

const getErrorMessage = (error: unknown) =>
  error instanceof Error ? error.message : String(error);

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

export const appProcedure = procedure.defaults({
  route: {
    onError: sharedOnError,
  },
});
