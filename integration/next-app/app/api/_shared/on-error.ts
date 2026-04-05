import { isRpcError, type ProcedureOnError } from "rpc4next/server";

export const onError = ((error, { response }) => {
  if (error instanceof Response) {
    return error;
  }

  if (isRpcError(error)) {
    return response.json(error.toJSON(), {
      status: error.status,
    });
  }

  return response.json(
    {
      error: {
        code: "INTERNAL_SERVER_ERROR",
        message:
          error instanceof Error ? error.message : "Unknown integration error",
      },
    },
    { status: 500 },
  );
}) satisfies ProcedureOnError;
