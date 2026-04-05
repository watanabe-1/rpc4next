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

export const createProcedureKit = <TOnError extends ProcedureOnError>(options: {
  onError: TOnError;
}) => {
  const kitRpcError = (<TCode extends RpcErrorCode, TDetails = unknown>(
    code: TCode,
    init?: RpcErrorInit<TCode, TDetails>,
  ) => baseRpcError(code, init)) as typeof baseRpcError;
  const nextRoute = <
    TProcedure,
    TMethod extends HttpMethod | undefined = undefined,
    TValidateOutput extends boolean = false,
  >(
    procedureDefinition: TProcedure,
    routeOptions?: Omit<
      NextRouteOptions<Exclude<TMethod, undefined>, TOnError>,
      "onError"
    > & {
      validateOutput?: TValidateOutput;
    },
  ): NextRouteHandler<
    TProcedure & Parameters<typeof baseNextRoute>[0],
    TMethod,
    TValidateOutput,
    TOnError
  > =>
    baseNextRoute(
      procedureDefinition as never,
      {
        ...routeOptions,
        onError: options.onError,
      } as never,
    ) as NextRouteHandler<
      TProcedure & Parameters<typeof baseNextRoute>[0],
      TMethod,
      TValidateOutput,
      TOnError
    >;

  return {
    procedure,
    rpcError: kitRpcError,
    nextRoute,
  };
};
