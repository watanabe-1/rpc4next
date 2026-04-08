import type { HttpMethod } from "rpc4next-shared";
import {
  rpcError as baseRpcError,
  type RpcErrorCode,
  type RpcErrorInit,
} from "./error";
import {
  nextRoute as baseNextRoute,
  type NextRouteHandler,
  type NextRouteOptions,
} from "./next-route";
import type { ProcedureOnError } from "./on-error";
import { procedure } from "./procedure";

export interface CreateProcedureKitOptions {
  onError: ProcedureOnError;
}

export const createProcedureKit = <TOnError extends ProcedureOnError>(
  options: CreateProcedureKitOptions & {
    onError: TOnError;
  },
) => {
  const presetProcedure = procedure.defaults({
    onError: options.onError,
  });
  const kitRpcError = (<TCode extends RpcErrorCode, TDetails = unknown>(
    code: TCode,
    init?: RpcErrorInit<TCode, TDetails>,
  ) => baseRpcError(code, init)) as typeof baseRpcError;
  const nextRoute = <
    TProcedure,
    TMethod extends HttpMethod | undefined = undefined,
    TValidateOutput extends boolean = false,
    TRouteOnError extends ProcedureOnError = TOnError,
  >(
    procedureDefinition: TProcedure,
    routeOptions?: Omit<
      NextRouteOptions<Exclude<TMethod, undefined>, TRouteOnError>,
      "onError"
    > & {
      onError?: TRouteOnError;
      validateOutput?: TValidateOutput;
    },
  ): NextRouteHandler<
    TProcedure & Parameters<typeof baseNextRoute>[0],
    TMethod,
    TValidateOutput,
    TRouteOnError
  > =>
    baseNextRoute(
      procedureDefinition as never,
      {
        ...routeOptions,
        onError: routeOptions?.onError ?? options.onError,
      } as never,
    ) as NextRouteHandler<
      TProcedure & Parameters<typeof baseNextRoute>[0],
      TMethod,
      TValidateOutput,
      TRouteOnError
    >;

  return {
    procedure: presetProcedure,
    rpcError: kitRpcError,
    nextRoute,
  };
};
