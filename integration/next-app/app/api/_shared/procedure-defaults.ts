import { type ProcedureOnError, procedure } from "rpc4next/server";

const sharedOnError = ((error, { response }) => {
  if (error instanceof Response) {
    return error;
  }

  return response.json(
    {
      success: false,
      error: {
        message: error instanceof Error ? error.message : "unknown error",
      },
    },
    { status: 500 },
  );
}) satisfies ProcedureOnError;

export const appProcedure = procedure.defaults({
  onError: sharedOnError,
});

export { procedure };
