import { type ProcedureOnError, procedure } from "rpc4next/server";

const sharedOnError = ((error, { response }) => {
  if (error instanceof Response) {
    return error;
  }

  return response.error("INTERNAL_SERVER_ERROR", {
    message: error instanceof Error ? error.message : "unknown error",
  });
}) satisfies ProcedureOnError;

export const appProcedure = procedure.defaults({
  route: {
    onError: sharedOnError,
  },
});
