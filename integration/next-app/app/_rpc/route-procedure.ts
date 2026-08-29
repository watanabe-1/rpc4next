import { procedure } from "rpc4next/server";

import { routeOnError, routeOnValidationError } from "./errors";

export const appRouteProcedure = procedure.defaults({
  route: {
    onError: routeOnError,
    onValidationError: routeOnValidationError,
  },
});
