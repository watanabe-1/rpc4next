import type { HttpMethod } from "rpc4next-shared";

import type {
  DefaultProcedurePageOnError,
  NextPageProcedureOptions,
  NextPageRender,
  NextPageProcedureCarrier,
  ProcedurePageOnError,
} from "./next-page";
import type { NextRouteProcedureOptions } from "./next-route";
import type { ProcedureOnError } from "./on-error";
import type { ProcedureMiddleware } from "./procedure";
import type { ProcedureDefinition } from "./procedure-types";

type ProcedureRouteAdapterCarrier = {
  definition: ProcedureDefinition;
  middlewares: readonly ProcedureMiddleware[];
  handler: (...args: never[]) => unknown;
  middlewareTerminalResult: unknown;
};

export type ProcedureSharedDefaults<
  TRouteOnError extends ProcedureOnError = ProcedureOnError,
  TPageOnError extends ProcedurePageOnError = ProcedurePageOnError,
> = {
  route?: {
    onError: TRouteOnError;
  };
  page?: {
    onError: TPageOnError;
  };
};

export type ProcedureDefaults = ProcedureSharedDefaults<ProcedureOnError, ProcedurePageOnError>;

export type ExtractProcedureSharedRouteOnError<TDefaults> = TDefaults extends {
  route: { onError: infer TSharedOnError extends ProcedureOnError };
}
  ? TSharedOnError
  : ProcedureOnError;

export type ExtractProcedureSharedPageOnError<TDefaults> = TDefaults extends {
  page: { onError: infer TSharedOnError extends ProcedurePageOnError };
}
  ? TSharedOnError
  : DefaultProcedurePageOnError;

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
> =
  HasProcedureRouteDefaults<TDefaults> extends true
    ? Omit<NextRouteProcedureOptions<TProcedure, TMethod, TValidateOutput, TOnError>, "onError"> & {
        onError?: TOnError;
      }
    : NextRouteProcedureOptions<TProcedure, TMethod, TValidateOutput, TOnError>;

export type ProcedureNextPageOptions<
  TProcedure extends NextPageProcedureCarrier,
  TDefaults,
  TOnError extends ProcedurePageOnError,
> =
  HasProcedurePageDefaults<TDefaults> extends true
    ? Omit<NextPageProcedureOptions<TProcedure, TOnError>, "onError"> & {
        onError?: TOnError;
      }
    : NextPageProcedureOptions<TProcedure, TOnError>;

export type ProcedureNextPageArgs<
  TProcedure extends NextPageProcedureCarrier,
  TData,
  TContext extends object,
  TResult,
  TDefaults,
  TOnError extends ProcedurePageOnError,
> =
  NextPageProcedureOptions<TProcedure, TOnError> extends infer TConstraint
    ? TConstraint extends { __error__: string }
      ? [render: TConstraint, options?: never]
      : [
          render: NextPageRender<TProcedure, TData, TContext, TResult>,
          options?: ProcedureNextPageOptions<TProcedure, TDefaults, TOnError>,
        ]
    : never;
