import {
  rpcError as baseRpcError,
  getDefaultRpcErrorStatus,
  type RpcErrorCode,
  type RpcErrorInit,
} from "./error";
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
  const kitRpcError = (<TCode extends RpcErrorCode, TDetails = unknown>(
    code: TCode,
    init?: RpcErrorInit<TCode, TDetails>,
  ) => {
    const registryStatus = options.errorRegistry?.[code]?.status;

    return baseRpcError(code, {
      ...init,
      status: (init?.status ??
        registryStatus ??
        getDefaultRpcErrorStatus(code)) as RpcErrorInit<
        TCode,
        TDetails
      >["status"],
    });
  }) as typeof baseRpcError;
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
    rpcError: kitRpcError,
    defaultRpcErrorFormatter,
    errorRegistry: options.errorRegistry,
    nextRoute,
  };
};
