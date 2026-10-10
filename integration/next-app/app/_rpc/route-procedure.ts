import { createRouteProcedure } from "rpc4next/server";

import { appRpcErrors, routeOnError, routeOnValidationError } from "./errors";

export const appRouteProcedure = createRouteProcedure({
  errors: appRpcErrors,
  onError: routeOnError,
  onValidationError: routeOnValidationError,
});
