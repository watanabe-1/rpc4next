import type { ProcedureOnError } from "rpc4next/server";

const getErrorMessage = (error: unknown) =>
  error instanceof Error ? error.message : String(error);

export const onError = ((error, { response }) => {
  console.error("[rpc4next] Unexpected procedure error", {
    message: getErrorMessage(error),
    error,
  });

  return response.error("INTERNAL_SERVER_ERROR", {
    message: "Internal server error",
  });
}) satisfies ProcedureOnError;
