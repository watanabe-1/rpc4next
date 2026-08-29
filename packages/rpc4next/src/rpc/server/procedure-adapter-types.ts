import type { HttpMethod } from "rpc4next-shared";

import type { DefaultRpcErrorCatalog, RpcErrorCatalog } from "./error";
import type {
  DefaultProcedurePageOnError,
  NextPageProcedureOptions,
  NextPageRender,
  NextPageProcedureCarrier,
  ProcedurePageOnError,
  ProcedurePageOnValidationError,
} from "./next-page";
import type { NextRouteProcedureOptions } from "./next-route";
import type { ProcedureOnError, ProcedureOnErrorResult } from "./on-error";
import type { ProcedureMiddleware } from "./procedure";
import type {
  ProcedureDefinition,
  ProcedureInputTarget,
  ProcedureValidationErrorHandler,
  ProcedureValidationErrorHandlerResult,
} from "./procedure-types";

type ProcedureRouteAdapterCarrier = {
  definition: ProcedureDefinition;
  errorCatalog?: RpcErrorCatalog;
  middlewares: readonly ProcedureMiddleware[];
  handler: (...args: never[]) => unknown;
  middlewareTerminalResult: unknown;
};

export type ProcedureSharedRouteDefaults<
  TErrorCatalog extends RpcErrorCatalog = DefaultRpcErrorCatalog,
  TRouteOnError extends ProcedureOnError<ProcedureOnErrorResult, TErrorCatalog> = ProcedureOnError<
    ProcedureOnErrorResult,
    TErrorCatalog
  >,
  TRouteOnValidationError extends
    | ProcedureValidationErrorHandler<
        ProcedureInputTarget,
        unknown,
        ProcedureValidationErrorHandlerResult,
        TErrorCatalog
      >
    | undefined = undefined,
> = {
  route: {
    onError: TRouteOnError;
    onValidationError?: TRouteOnValidationError;
  };
  page?: never;
};

export type ProcedureSharedPageDefaults<
  TPageOnError extends ProcedurePageOnError = ProcedurePageOnError,
  TPageOnValidationError extends ProcedurePageOnValidationError | undefined = undefined,
> = {
  route?: never;
  page: {
    onError: TPageOnError;
    onValidationError?: TPageOnValidationError;
  };
};

export type ProcedureSharedDefaults<
  TErrorCatalog extends RpcErrorCatalog = DefaultRpcErrorCatalog,
  TRouteOnError extends ProcedureOnError<ProcedureOnErrorResult, TErrorCatalog> = ProcedureOnError<
    ProcedureOnErrorResult,
    TErrorCatalog
  >,
  TPageOnError extends ProcedurePageOnError = ProcedurePageOnError,
  TRouteOnValidationError extends
    | ProcedureValidationErrorHandler<
        ProcedureInputTarget,
        unknown,
        ProcedureValidationErrorHandlerResult,
        TErrorCatalog
      >
    | undefined = undefined,
  TPageOnValidationError extends ProcedurePageOnValidationError | undefined = undefined,
> =
  | ProcedureSharedRouteDefaults<TErrorCatalog, TRouteOnError, TRouteOnValidationError>
  | ProcedureSharedPageDefaults<TPageOnError, TPageOnValidationError>;

export type ProcedureDefaults<TErrorCatalog extends RpcErrorCatalog = DefaultRpcErrorCatalog> =
  ProcedureSharedDefaults<
    TErrorCatalog,
    ProcedureOnError<ProcedureOnErrorResult, TErrorCatalog>,
    ProcedurePageOnError,
    | ProcedureValidationErrorHandler<
        ProcedureInputTarget,
        unknown,
        ProcedureValidationErrorHandlerResult,
        TErrorCatalog
      >
    | undefined,
    ProcedurePageOnValidationError | undefined
  >;

export type ExtractProcedureSharedRouteOnError<TDefaults> = TDefaults extends {
  route: { onError: infer TSharedOnError extends ProcedureOnError<any, any> };
}
  ? TSharedOnError
  : ProcedureOnError<any, any>;

export type ExtractProcedureSharedRouteOnValidationError<TDefaults> = TDefaults extends {
  route: {
    onValidationError?: infer TSharedOnValidationError extends
      | ProcedureValidationErrorHandler<any, any, any, any>
      | undefined;
  };
}
  ? TSharedOnValidationError
  : undefined;

export type ExtractProcedureSharedPageOnError<TDefaults> = TDefaults extends {
  page: { onError: infer TSharedOnError extends ProcedurePageOnError };
}
  ? TSharedOnError
  : DefaultProcedurePageOnError;

export type ExtractProcedureSharedPageOnValidationError<TDefaults> = TDefaults extends {
  page: {
    onValidationError?: infer TSharedOnValidationError extends
      | ProcedurePageOnValidationError
      | undefined;
  };
}
  ? TSharedOnValidationError
  : undefined;

type HasProcedureRouteDefaults<TDefaults> = TDefaults extends {
  route: { onError: ProcedureOnError<any, any> };
}
  ? true
  : false;

type HasProcedurePageDefaults<TDefaults> = TDefaults extends {
  page: { onError: ProcedurePageOnError };
}
  ? true
  : false;

export type ProcedureNextRouteOptions<
  TProcedure extends ProcedureRouteAdapterCarrier,
  TMethod extends HttpMethod,
  TValidateOutput extends boolean,
  TDefaults,
  TOnError extends ProcedureOnError<any, any>,
  TOnValidationError extends ProcedureValidationErrorHandler<any, any, any, any> | undefined,
> =
  HasProcedureRouteDefaults<TDefaults> extends true
    ? Omit<
        NextRouteProcedureOptions<
          TProcedure,
          TMethod,
          TValidateOutput,
          ExtractProcedureSharedRouteOnError<TDefaults>,
          TOnValidationError
        >,
        "onError" | "onValidationError"
      > &
        (
          | {
              onError?: never;
              onValidationError?: TOnValidationError;
            }
          | {
              onError: TOnError;
              onValidationError?: TOnValidationError;
            }
        )
    : NextRouteProcedureOptions<TProcedure, TMethod, TValidateOutput, TOnError, TOnValidationError>;

export type ProcedureNextPageOptions<
  TProcedure extends NextPageProcedureCarrier,
  TDefaults,
  TOnError extends ProcedurePageOnError,
  TOnValidationError extends ProcedurePageOnValidationError | undefined,
> =
  HasProcedurePageDefaults<TDefaults> extends true
    ? Omit<
        NextPageProcedureOptions<TProcedure, TOnError, TOnValidationError>,
        "onError" | "onValidationError"
      > & {
        onError?: TOnError;
        onValidationError?: TOnValidationError;
      }
    : NextPageProcedureOptions<TProcedure, TOnError, TOnValidationError>;

export type ProcedureNextPageArgs<
  TProcedure extends NextPageProcedureCarrier,
  TData,
  TContext extends object,
  TResult,
  TDefaults,
  TOnError extends ProcedurePageOnError,
  TOnValidationError extends ProcedurePageOnValidationError | undefined,
> =
  NextPageProcedureOptions<TProcedure, TOnError, TOnValidationError> extends infer TConstraint
    ? TConstraint extends { __error__: string }
      ? [render: TConstraint, options?: never]
      : [
          render: NextPageRender<TProcedure, TData, TContext, TResult>,
          options?: ProcedureNextPageOptions<TProcedure, TDefaults, TOnError, TOnValidationError>,
        ]
    : never;
