import {
  createProcedureKit,
  isRpcError,
  procedure,
  rpcError,
} from "rpc4next/server";

export const procedureKit = createProcedureKit({
  errorFormatter: (error, response) => {
    if (!isRpcError(error)) {
      return undefined;
    }

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
  },
  errorRegistry: {
    FORBIDDEN: { status: 403 },
  },
});

export { procedure, rpcError };
