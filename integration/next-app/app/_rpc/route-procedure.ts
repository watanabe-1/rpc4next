import { procedure } from "rpc4next/server";

import { appRpcErrors, routeOnError, routeOnValidationError } from "./errors";

export const appRouteProcedure = procedure.errors(appRpcErrors).defaults({
  route: {
    onError: routeOnError,
    onValidationError: routeOnValidationError,
  },
});
