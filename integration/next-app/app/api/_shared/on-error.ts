import type { ProcedureOnError } from "rpc4next/server";

export const onError = ((error, { response }) => {
  if (error instanceof Response) {
    return error;
  }

  return response.error("INTERNAL_SERVER_ERROR", {
    message: error instanceof Error ? error.message : "Unknown integration error",
  });
}) satisfies ProcedureOnError;
