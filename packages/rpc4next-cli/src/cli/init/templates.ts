export const INIT_CONFIG = `${JSON.stringify(
  {
    baseDir: "app",
    outputPath: "src/generated/rpc.ts",
    paramsFile: "route-contract.ts",
  },
  null,
  2,
)}
`;

export const RPC_CLIENT = `import { createRpcClient } from "rpc4next/client";
import type { PathStructure } from "../generated/rpc";

export const rpc = createRpcClient<PathStructure>("");
`;

export const RPC_ERRORS = `import { createRpcValidationErrorHandler, defineRpcErrors } from "rpc4next/server";
import type {
  ProcedureInputTarget,
  ProcedureOnError,
  ProcedureOnErrorResult,
  ProcedureValidationErrorHandler,
  ProcedureValidationErrorHandlerResult,
} from "rpc4next/server";

export const appRpcErrors = defineRpcErrors({});

export const getErrorMessage = (error: unknown) =>
  error instanceof Error ? error.message : String(error);

export const routeOnError = ((error, { response }) => {
  console.error("[rpc4next] Unexpected procedure error", {
    message: getErrorMessage(error),
    error,
  });

  return response.error("INTERNAL_SERVER_ERROR", {
    message: "Internal server error",
  });
}) satisfies ProcedureOnError<ProcedureOnErrorResult, typeof appRpcErrors>;

export const routeOnValidationError =
  createRpcValidationErrorHandler<
    ProcedureInputTarget,
    typeof appRpcErrors
  >() satisfies ProcedureValidationErrorHandler<
    ProcedureInputTarget,
    unknown,
    ProcedureValidationErrorHandlerResult,
    typeof appRpcErrors
  >;

export const pageOnError = () => {
  throw new Error("Unhandled rpc4next page procedure error.");
};
`;

export const ROUTE_PROCEDURE = `import { procedure } from "rpc4next/server";

import { appRpcErrors, routeOnError, routeOnValidationError } from "./errors";

export const appRouteProcedure = procedure.errors(appRpcErrors).defaults({
  route: {
    onError: routeOnError,
    onValidationError: routeOnValidationError,
  },
});
`;

export const PAGE_PROCEDURE = `import { procedure } from "rpc4next/server";

import { pageOnError } from "./errors";

export const appPageProcedure = procedure.defaults({
  page: {
    onError: pageOnError,
  },
});
`;

export const INIT_TEMPLATE_FILES = [
  {
    path: "rpc4next.config.json",
    content: INIT_CONFIG,
  },
  {
    path: "src/lib/rpc-client.ts",
    content: RPC_CLIENT,
  },
  {
    path: "app/_rpc/errors.ts",
    content: RPC_ERRORS,
  },
  {
    path: "app/_rpc/route-procedure.ts",
    content: ROUTE_PROCEDURE,
  },
  {
    path: "app/_rpc/page-procedure.ts",
    content: PAGE_PROCEDURE,
  },
] as const;

export const INIT_GENERATED_RPC_PATH = "src/generated/rpc.ts";
export const INIT_BASE_DIR = "app";
export const INIT_PARAMS_FILE = "route-contract.ts";
