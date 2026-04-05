import { createProcedureKit, isRpcError, procedure } from "rpc4next/server";

export const procedureKit = createProcedureKit({
  onError: (error, { response }) => {
    if (error instanceof Response) {
      return error;
    }

    if (isRpcError(error)) {
      return response.json(
        {
          success: false,
          error: {
            code: error.code,
            message: error.message,
            details: error.details,
          },
        },
        { status: error.status },
      );
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
  },
});

export const rpcError = procedureKit.rpcError;

export { procedure };
