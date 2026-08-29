import type { HttpMethod } from "rpc4next-shared";

import type {
  DefaultProcedurePageOnError,
  NextPageProcedureOptions,
  NextPageRender,
  NextPageProcedureCarrier,
  ProcedurePageOnError,
  ProcedurePageOnValidationError,
} from "./next-page";
import type { NextRouteProcedureOptions } from "./next-route";
import type { ProcedureOnError } from "./on-error";
import type { ProcedureMiddleware } from "./procedure";
import type { ProcedureDefinition, ProcedureValidationErrorHandler } from "./procedure-types";

type ProcedureRouteAdapterCarrier = {
  definition: ProcedureDefinition;
  middlewares: readonly ProcedureMiddleware[];
  handler: (...args: never[]) => unknown;
  middlewareTerminalResult: unknown;
};

export type ProcedureSharedRouteDefaults<
  TRouteOnError extends ProcedureOnError = ProcedureOnError,
  TRouteOnValidationError extends ProcedureValidationErrorHandler | undefined = undefined,
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
  TRouteOnError extends ProcedureOnError = ProcedureOnError,
  TPageOnError extends ProcedurePageOnError = ProcedurePageOnError,
  TRouteOnValidationError extends ProcedureValidationErrorHandler | undefined = undefined,
  TPageOnValidationError extends ProcedurePageOnValidationError | undefined = undefined,
> =
  | ProcedureSharedRouteDefaults<TRouteOnError, TRouteOnValidationError>
  | ProcedureSharedPageDefaults<TPageOnError, TPageOnValidationError>;

export type ProcedureDefaults = ProcedureSharedDefaults<
  ProcedureOnError,
  ProcedurePageOnError,
  ProcedureValidationErrorHandler | undefined,
  ProcedurePageOnValidationError | undefined
>;

export type ExtractProcedureSharedRouteOnError<TDefaults> = TDefaults extends {
  route: { onError: infer TSharedOnError extends ProcedureOnError };
}
  ? TSharedOnError
  : ProcedureOnError;

export type ExtractProcedureSharedRouteOnValidationError<TDefaults> = TDefaults extends {
  route: {
    onValidationError?: infer TSharedOnValidationError extends
      | ProcedureValidationErrorHandler
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
  route: { onError: ProcedureOnError };
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
  TOnError extends ProcedureOnError,
  TOnValidationError extends ProcedureValidationErrorHandler | undefined,
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
