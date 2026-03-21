import { rpcError } from "./error";
import {
  defaultRpcErrorFormatter,
  type ProcedureErrorFormatter,
} from "./error-formatter";
import { nextRoute as baseNextRoute } from "./next-route";
import { procedure } from "./procedure";

export interface ProcedureErrorRegistryEntry {
  status: number;
}

export type ProcedureErrorRegistry = Record<
  string,
  ProcedureErrorRegistryEntry
>;

export interface CreateProcedureKitOptions {
  errorFormatter?: ProcedureErrorFormatter;
  errorRegistry?: ProcedureErrorRegistry;
}

export const createProcedureKit = (options: CreateProcedureKitOptions = {}) => {
  const kitErrorFormatter = options.errorFormatter ?? defaultRpcErrorFormatter;
  const nextRoute = ((procedureDefinition, routeOptions) =>
    baseNextRoute(
      procedureDefinition as never,
      {
        ...routeOptions,
        errorFormatter: routeOptions?.errorFormatter ?? kitErrorFormatter,
      } as never,
    )) as typeof baseNextRoute;

  return {
    procedure,
    rpcError,
    defaultRpcErrorFormatter,
    errorRegistry: options.errorRegistry,
    nextRoute,
  };
};
