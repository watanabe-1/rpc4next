import type { NextRequest, NextResponse } from "next/server";
import type { HttpMethod } from "rpc4next-shared";

import type { HttpStatusCode } from "../lib/http-status-code-types";
import { defaultRpcErrorCatalog } from "./error";
import type { DefaultRpcErrorCatalog, RpcErrorCatalog } from "./error";
import type { RpcMeta } from "./meta";
import {
  nextPage as adaptProcedureToNextPage,
  type NextPageHandler,
  type ProcedurePageOnError,
  type ProcedurePageOnValidationError,
} from "./next-page";
import { nextRoute as adaptProcedureToNextRoute, type NextRouteExports } from "./next-route";
import type { ProcedureOnError } from "./on-error";
import type {
  ExtractProcedureSharedPageOnError,
  ExtractProcedureSharedPageOnValidationError,
  ExtractProcedureSharedRouteOnError,
  ExtractProcedureSharedRouteOnValidationError,
  ProcedureDefaults,
  ProcedureNextPageArgs,
  ProcedureNextRouteOptions,
  ProcedureSharedDefaults,
} from "./procedure-adapter-types";
import {
  withProcedureInputContract,
  withProcedureMeta,
  withProcedureOutput,
  withProcedureRouteBinding,
} from "./procedure-internals";
import {
  type EmptyProcedureDefinition,
  type MergeProcedureDefinition,
  type ProcedureDefinition,
  type ProcedureInputContract,
  type ProcedureInputOptions,
  type ProcedureInputTarget,
  type ProcedureOutputContract,
  type ProcedureRouteBinding,
  type ProcedureRouteContract,
  type ProcedureValidationErrorHandlerResult,
  type ProcedureValidationErrorHandler,
  type ProcedureValidationErrorResponseMap,
} from "./procedure-types";
import type { ValidationSchema } from "./route-types";
import type { InferSchemaInput, InferSchemaOutput } from "./schema-inference";
import type { StandardSchemaV1 } from "./standard-schema";
import type { Params, Query, ResponseHelpers } from "./types";

export type ProcedureAdapterMode = "neutral" | "route" | "page";

export type ProcedurePageHelpers = {
  redirect: (url: string, type?: "replace" | "push") => never;
  notFound: () => never;
};

type ExtractValidationSchema<TDefinition extends ProcedureDefinition> =
  TDefinition extends ProcedureDefinition<infer _THttpMethod, infer TValidationSchema>
    ? TValidationSchema
    : ValidationSchema;

type ExtractProcedureOutput<TDefinition extends ProcedureDefinition> =
  TDefinition extends ProcedureDefinition<
    infer _THttpMethod,
    infer _TValidationSchema,
    infer TOutput
  >
    ? TOutput
    : unknown;

type ExtractProcedureRouteBinding<TDefinition extends ProcedureDefinition> =
  TDefinition extends ProcedureDefinition<
    infer _THttpMethod,
    infer _TValidationSchema,
    infer _TRouteResponse,
    infer _TMeta,
    infer TRoute
  >
    ? TRoute
    : undefined;

type ExtractProcedureMiddlewareContextExtension<TMiddleware> =
  TMiddleware extends ProcedureMiddleware<
    infer _TValidationSchema,
    infer _TBoundParams,
    infer _TContext,
    infer TContextExtension,
    infer _TErrorCatalog,
    infer _TMode extends ProcedureAdapterMode
  >
    ? TContextExtension
    : Record<never, never>;

type ExtractProcedureMiddlewareTerminalResult<TMiddleware> = TMiddleware extends (
  ...args: any[]
) => infer TResult
  ? Extract<Awaited<TResult>, Response | NextResponse | ProcedureResult>
  : never;

type MergeProcedureDefinitionWithMiddleware<
  TDefinition extends ProcedureDefinition,
  _TMiddleware,
> = TDefinition;

type ExtractBoundRouteParams<TDefinition extends ProcedureDefinition> =
  ExtractProcedureRouteBinding<TDefinition> extends ProcedureRouteBinding<string, infer TParams>
    ? TParams
    : never;

type HasBoundRouteParams<TDefinition extends ProcedureDefinition> = [
  ExtractBoundRouteParams<TDefinition>,
] extends [never]
  ? false
  : keyof ExtractBoundRouteParams<TDefinition> extends never
    ? false
    : true;

type HasValidatedParams<TDefinition extends ProcedureDefinition> =
  ExtractValidationSchema<TDefinition>["output"] extends {
    params: unknown;
  }
    ? true
    : false;

type InferProcedureParams<TDefinition extends ProcedureDefinition> =
  "params" extends keyof ExtractValidationSchema<TDefinition>["output"]
    ? ProcedureValueFor<
        ExtractValidationSchema<TDefinition>,
        "params",
        ExtractBoundRouteParams<TDefinition>
      >
    : [ExtractBoundRouteParams<TDefinition>] extends [never]
      ? Params
      : ExtractBoundRouteParams<TDefinition>;

type ProcedureValueFor<
  TValidationSchema extends ValidationSchema,
  TTarget extends ProcedureInputTarget,
  TFallback,
> = TTarget extends keyof TValidationSchema["output"]
  ? TValidationSchema["output"][TTarget]
  : TFallback;

type ExtendValidationSchema<
  TValidationSchema extends ValidationSchema,
  TTarget extends ProcedureInputTarget,
  TSchema,
> = {
  input: TValidationSchema["input"] & Record<TTarget, InferSchemaInput<TSchema>>;
  output: TValidationSchema["output"] & Record<TTarget, InferSchemaOutput<TSchema>>;
};

type ExtendProcedureInputDefinition<
  TDefinition extends ProcedureDefinition,
  TTarget extends ProcedureInputTarget,
  TSchema extends StandardSchemaV1,
  TOnValidationErrorResult extends ProcedureValidationErrorHandlerResult = never,
> = MergeProcedureDefinition<
  TDefinition,
  {
    input: ProcedureInputContract<
      ExtendValidationSchema<ExtractValidationSchema<TDefinition>, TTarget, TSchema>,
      ExtractProcedureValidationErrorResponses<TDefinition> &
        Record<TTarget, InferProcedureValidationErrorRouteResponse<TOnValidationErrorResult>>
    > & {
      contracts: NonNullable<TDefinition["input"]>["contracts"] & Record<TTarget, TSchema>;
    };
  }
>;

type ExtractProcedureValidationErrorResponses<TDefinition extends ProcedureDefinition> =
  TDefinition extends {
    input: ProcedureInputContract<ValidationSchema, infer TValidationErrorResponses>;
  }
    ? TValidationErrorResponses
    : Record<never, never>;

type InferProcedureValidationErrorRouteResponse<TOnValidationErrorResult> = Exclude<
  Extract<
    Awaited<TOnValidationErrorResult>,
    ProcedureValidationErrorResponseMap[ProcedureInputTarget]
  >,
  undefined
>;

type HasProcedureInputContractTarget<
  TDefinition extends ProcedureDefinition,
  TTarget extends ProcedureInputTarget,
> = TDefinition extends {
  input: ProcedureInputContract<infer TValidationSchema>;
}
  ? TTarget extends keyof TValidationSchema["input"]
    ? true
    : false
  : false;

type BodyContractConflictError<
  TUsed extends "json" | "formData",
  TNext extends "json" | "formData",
> = {
  __error__: "Procedure body contracts are mutually exclusive; use either .json(schema) or .formData(schema), not both.";
  __existingBodyContract__: TUsed;
  __nextBodyContract__: TNext;
};

type BodyContractSchemaArg<
  TDefinition extends ProcedureDefinition,
  TTarget extends "json" | "formData",
  TSchema extends StandardSchemaV1,
> = TTarget extends "json"
  ? HasProcedureInputContractTarget<TDefinition, "formData"> extends true
    ? TSchema & BodyContractConflictError<"formData", "json">
    : TSchema
  : HasProcedureInputContractTarget<TDefinition, "json"> extends true
    ? TSchema & BodyContractConflictError<"json", "formData">
    : TSchema;

type InvalidBoundRouteParamsSchema<TExpected, TActual> = {
  __error__: "Procedure params schema output must cover the generated route params contract.";
  __expectedParams__: TExpected;
  __actualParams__: TActual;
};

type BoundRouteParamsSchemaArg<
  TDefinition extends ProcedureDefinition,
  TSchema extends StandardSchemaV1,
> =
  HasBoundRouteParams<TDefinition> extends true
    ? InferSchemaOutput<TSchema> extends ExtractBoundRouteParams<TDefinition>
      ? TSchema
      : TSchema &
          InvalidBoundRouteParamsSchema<
            ExtractBoundRouteParams<TDefinition>,
            InferSchemaOutput<TSchema>
          >
    : TSchema;

type MissingBoundRouteParamsError = {
  __error__: "Bound procedures with generated params must call .params(schema) before .handle().";
};

type ProcedureHandleArgs<
  TDefinition extends ProcedureDefinition,
  TContext extends object,
  TMode extends ProcedureAdapterMode,
  TErrorCatalog extends RpcErrorCatalog,
  THandler extends ProcedureHandler<
    ExtractValidationSchema<TDefinition>,
    InferProcedureParams<TDefinition>,
    TContext,
    ExtractProcedureOutput<TDefinition>,
    TErrorCatalog,
    TMode
  >,
> =
  HasBoundRouteParams<TDefinition> extends true
    ? HasValidatedParams<TDefinition> extends true
      ? [handler: THandler]
      : [handler: THandler & MissingBoundRouteParamsError]
    : [handler: THandler];

export type ProcedureResult<TBody = unknown> = {
  status?: HttpStatusCode;
  headers?: HeadersInit;
  body?: TBody;
  redirect?: string;
};

export type ProcedureResponseHelpers<
  TOutput = unknown,
  TErrorCatalog extends RpcErrorCatalog = DefaultRpcErrorCatalog,
> = ResponseHelpers<TOutput, TErrorCatalog>;

export type ProcedurePageResult<TBody = unknown> = Omit<ProcedureResult<TBody>, "redirect"> & {
  redirect?: never;
};

type ProcedureValidatedContext<
  TValidationSchema extends ValidationSchema,
  TBoundParams,
> = ("params" extends keyof TValidationSchema["output"]
  ? {
      params: ProcedureValueFor<TValidationSchema, "params", TBoundParams>;
    }
  : Record<never, never>) &
  ("query" extends keyof TValidationSchema["output"]
    ? {
        query: ProcedureValueFor<TValidationSchema, "query", Query>;
      }
    : Record<never, never>) &
  ("json" extends keyof TValidationSchema["output"]
    ? {
        json: ProcedureValueFor<TValidationSchema, "json", undefined>;
      }
    : Record<never, never>) &
  ("formData" extends keyof TValidationSchema["output"]
    ? {
        formData: ProcedureValueFor<TValidationSchema, "formData", undefined>;
      }
    : Record<never, never>) &
  ("headers" extends keyof TValidationSchema["output"]
    ? {
        headers: ProcedureValueFor<TValidationSchema, "headers", undefined>;
      }
    : Record<never, never>) &
  ("cookies" extends keyof TValidationSchema["output"]
    ? {
        cookies: ProcedureValueFor<TValidationSchema, "cookies", undefined>;
      }
    : Record<never, never>);

export type ProcedureHandlerContext<
  TValidationSchema extends ValidationSchema = ValidationSchema,
  TBoundParams = Params,
  TContext extends object = Record<never, never>,
  TOutput = unknown,
  TErrorCatalog extends RpcErrorCatalog = DefaultRpcErrorCatalog,
  TMode extends ProcedureAdapterMode = "neutral",
> = ProcedureValidatedContext<TValidationSchema, TBoundParams> & {
  request: NextRequest;
  ctx: TContext;
} & (TMode extends "page"
    ? {
        page: ProcedurePageHelpers;
      }
    : {
        response: ProcedureResponseHelpers<TOutput, TErrorCatalog>;
      });

export type ProcedureMiddlewareContext<
  TValidationSchema extends ValidationSchema = ValidationSchema,
  TBoundParams = Params,
  TContext extends object = Record<never, never>,
  TErrorCatalog extends RpcErrorCatalog = DefaultRpcErrorCatalog,
  TMode extends ProcedureAdapterMode = "neutral",
> = ProcedureValidatedContext<TValidationSchema, TBoundParams> & {
  request: NextRequest;
  ctx: TContext;
} & (TMode extends "page"
    ? {
        page: ProcedurePageHelpers;
      }
    : {
        response: ResponseHelpers<unknown, TErrorCatalog>;
      });

type ProcedureRouteTerminalResult = Response | NextResponse | ProcedureResult;

type ProcedurePageMiddlewareResult<TContextExtension extends object = Record<never, never>> =
  | undefined
  | { ctx: TContextExtension };

export type ProcedureMiddlewareResult<
  TContextExtension extends object = Record<never, never>,
  TMode extends ProcedureAdapterMode = "neutral",
> = TMode extends "page"
  ? ProcedurePageMiddlewareResult<TContextExtension>
  : undefined | ProcedureRouteTerminalResult | { ctx: TContextExtension };

export type ProcedureHandlerResult<
  TOutput = unknown,
  TMode extends ProcedureAdapterMode = "neutral",
> = TMode extends "page"
  ? ProcedurePageResult<TOutput> | Promise<ProcedurePageResult<TOutput>>
  :
      | Response
      | NextResponse
      | ProcedureResult<TOutput>
      | Promise<Response | NextResponse | ProcedureResult<TOutput>>;

type ProcedureAnyHandlerResult<TOutput = unknown> =
  | Response
  | NextResponse
  | ProcedureResult<TOutput>
  | Promise<Response | NextResponse | ProcedureResult<TOutput>>;

export type ProcedureMiddleware<
  TValidationSchema extends ValidationSchema = ValidationSchema,
  TBoundParams = Params,
  TContext extends object = Record<never, never>,
  TContextExtension extends object = Record<never, never>,
  TErrorCatalog extends RpcErrorCatalog = DefaultRpcErrorCatalog,
  TMode extends ProcedureAdapterMode = "neutral",
> = (
  context: ProcedureMiddlewareContext<
    TValidationSchema,
    TBoundParams,
    TContext,
    TErrorCatalog,
    TMode
  >,
) =>
  | Promise<ProcedureMiddlewareResult<TContextExtension, TMode>>
  | ProcedureMiddlewareResult<TContextExtension, TMode>;

export type ProcedureHandler<
  TValidationSchema extends ValidationSchema = ValidationSchema,
  TBoundParams = Params,
  TContext extends object = Record<never, never>,
  TOutput = unknown,
  TErrorCatalog extends RpcErrorCatalog = DefaultRpcErrorCatalog,
  TMode extends ProcedureAdapterMode = "neutral",
> = (
  context: ProcedureHandlerContext<
    TValidationSchema,
    TBoundParams,
    TContext,
    TOutput,
    TErrorCatalog,
    TMode
  >,
) => ProcedureHandlerResult<TOutput, TMode>;

type ProcedureBase<
  TDefinition extends ProcedureDefinition = EmptyProcedureDefinition,
  TContext extends object = Record<never, never>,
  TOutput = ExtractProcedureOutput<TDefinition>,
  TErrorCatalog extends RpcErrorCatalog = DefaultRpcErrorCatalog,
  THandler extends (...args: never[]) => ProcedureAnyHandlerResult<TOutput> = ProcedureHandler<
    ExtractValidationSchema<TDefinition>,
    InferProcedureParams<TDefinition>,
    TContext,
    TOutput,
    TErrorCatalog
  >,
  TMiddlewareTerminalResult = never,
> = {
  readonly definition: TDefinition;
  readonly errorCatalog: TErrorCatalog;
  readonly middlewares: readonly ProcedureMiddleware[];
  readonly handler: THandler;
  readonly middlewareTerminalResult: TMiddlewareTerminalResult;
};

type ProcedureNextRouteMethod<
  TDefinition extends ProcedureDefinition,
  TContext extends object,
  TOutput,
  THandler extends (...args: never[]) => ProcedureAnyHandlerResult<TOutput>,
  TDefaults,
  TErrorCatalog extends RpcErrorCatalog,
  TMiddlewareTerminalResult,
> = <
  TMethod extends HttpMethod = HttpMethod,
  TValidateOutput extends boolean = false,
  TOnError extends ProcedureOnError<any, any> = ExtractProcedureSharedRouteOnError<TDefaults>,
  TOnValidationError extends
    | ProcedureValidationErrorHandler<any, any, any, TErrorCatalog>
    | undefined = ExtractProcedureSharedRouteOnValidationError<TDefaults>,
>(
  options: ProcedureNextRouteOptions<
    Procedure<
      TDefinition,
      TContext,
      TOutput,
      THandler,
      TDefaults,
      TErrorCatalog,
      TMiddlewareTerminalResult
    >,
    TMethod,
    TValidateOutput,
    TDefaults,
    TOnError,
    TOnValidationError
  >,
) => NextRouteExports<
  Procedure<
    TDefinition,
    TContext,
    TOutput,
    THandler,
    TDefaults,
    TErrorCatalog,
    TMiddlewareTerminalResult
  >,
  TMethod,
  TValidateOutput,
  TOnError,
  TOnValidationError
>;

type ExtractProcedureHandlerData<THandler, TFallback> = THandler extends (
  ...args: never[]
) => infer TResult
  ? Awaited<TResult> extends ProcedureResult<infer TBody>
    ? TBody
    : TFallback
  : TFallback;

type ProcedureNextPageMethod<
  TDefinition extends ProcedureDefinition,
  TContext extends object,
  TOutput,
  THandler extends (...args: never[]) => ProcedureAnyHandlerResult<TOutput>,
  TDefaults,
  TErrorCatalog extends RpcErrorCatalog,
  TMiddlewareTerminalResult,
> = <
  TResult = unknown,
  TOnError extends ProcedurePageOnError = ExtractProcedureSharedPageOnError<TDefaults>,
  TOnValidationError extends ProcedurePageOnValidationError | undefined =
    ExtractProcedureSharedPageOnValidationError<TDefaults>,
>(
  ...args: ProcedureNextPageArgs<
    Procedure<
      TDefinition,
      TContext,
      TOutput,
      THandler,
      TDefaults,
      TErrorCatalog,
      TMiddlewareTerminalResult
    >,
    ExtractProcedureHandlerData<THandler, TOutput>,
    TContext,
    TResult,
    TDefaults,
    TOnError,
    TOnValidationError
  >
) => NextPageHandler<
  Procedure<
    TDefinition,
    TContext,
    TOutput,
    THandler,
    TDefaults,
    TErrorCatalog,
    TMiddlewareTerminalResult
  >,
  | TResult
  | Awaited<ReturnType<TOnError>>
  | (TOnValidationError extends ProcedurePageOnValidationError
      ? Awaited<ReturnType<TOnValidationError>>
      : never)
>;

type ProcedureBuilderNextPageCarrier<
  TDefinition extends ProcedureDefinition,
  TErrorCatalog extends RpcErrorCatalog,
  TMiddlewareTerminalResult,
> = {
  readonly definition: TDefinition;
  readonly errorCatalog: TErrorCatalog;
  readonly middlewares: readonly ProcedureMiddleware[];
  readonly handler?: undefined;
  readonly middlewareTerminalResult: TMiddlewareTerminalResult;
};

type ProcedureBuilderNextPageMethod<
  TDefinition extends ProcedureDefinition,
  TContext extends object,
  TDefaults,
  TErrorCatalog extends RpcErrorCatalog,
  TMiddlewareTerminalResult,
> = <
  TResult = unknown,
  TOnError extends ProcedurePageOnError = ExtractProcedureSharedPageOnError<TDefaults>,
  TOnValidationError extends ProcedurePageOnValidationError | undefined =
    ExtractProcedureSharedPageOnValidationError<TDefaults>,
>(
  ...args: ProcedureNextPageArgs<
    ProcedureBuilderNextPageCarrier<TDefinition, TErrorCatalog, TMiddlewareTerminalResult>,
    never,
    TContext,
    TResult,
    TDefaults,
    TOnError,
    TOnValidationError
  >
) => NextPageHandler<
  ProcedureBuilderNextPageCarrier<TDefinition, TErrorCatalog, TMiddlewareTerminalResult>,
  | TResult
  | Awaited<ReturnType<TOnError>>
  | (TOnValidationError extends ProcedurePageOnValidationError
      ? Awaited<ReturnType<TOnValidationError>>
      : never)
>;

export type Procedure<
  TDefinition extends ProcedureDefinition = EmptyProcedureDefinition,
  TContext extends object = Record<never, never>,
  TOutput = ExtractProcedureOutput<TDefinition>,
  THandler extends (...args: never[]) => ProcedureAnyHandlerResult<TOutput> = ProcedureHandler<
    ExtractValidationSchema<TDefinition>,
    InferProcedureParams<TDefinition>,
    TContext,
    TOutput,
    DefaultRpcErrorCatalog
  >,
  TDefaults = undefined,
  TErrorCatalog extends RpcErrorCatalog = DefaultRpcErrorCatalog,
  TMiddlewareTerminalResult = never,
> = ProcedureBase<
  TDefinition,
  TContext,
  TOutput,
  TErrorCatalog,
  THandler,
  TMiddlewareTerminalResult
> &
  (ExtractProcedureAdapterMode<TDefaults> extends "page"
    ? {
        nextPage: ProcedureNextPageMethod<
          TDefinition,
          TContext,
          TOutput,
          THandler,
          TDefaults,
          TErrorCatalog,
          TMiddlewareTerminalResult
        >;
      }
    : ExtractProcedureAdapterMode<TDefaults> extends "route"
      ? {
          nextRoute: ProcedureNextRouteMethod<
            TDefinition,
            TContext,
            TOutput,
            THandler,
            TDefaults,
            TErrorCatalog,
            TMiddlewareTerminalResult
          >;
        }
      : {
          nextRoute: ProcedureNextRouteMethod<
            TDefinition,
            TContext,
            TOutput,
            THandler,
            TDefaults,
            TErrorCatalog,
            TMiddlewareTerminalResult
          >;
          nextPage: ProcedureNextPageMethod<
            TDefinition,
            TContext,
            TOutput,
            THandler,
            TDefaults,
            TErrorCatalog,
            TMiddlewareTerminalResult
          >;
        });

type HasProcedureOutput<TDefinition extends ProcedureDefinition> = TDefinition extends {
  output: ProcedureOutputContract;
}
  ? true
  : false;

type HasProcedureRoute<TDefinition extends ProcedureDefinition> = TDefinition extends {
  route: ProcedureRouteBinding;
}
  ? true
  : false;

type HasProcedureDefaults<TDefaults> = [TDefaults] extends [undefined] ? false : true;
type ProcedureDefaultsArg<TDefaults, TErrorCatalog extends RpcErrorCatalog> =
  TDefaults extends ProcedureDefaults<TErrorCatalog> ? TDefaults : ProcedureDefaults<TErrorCatalog>;

type ExtractProcedureAdapterMode<TDefaults> = TDefaults extends {
  page: { onError: ProcedurePageOnError };
}
  ? TDefaults extends {
      route: { onError: ProcedureOnError };
    }
    ? "neutral"
    : "page"
  : TDefaults extends {
        route: { onError: ProcedureOnError };
      }
    ? "route"
    : "neutral";

type UsedProcedureBuilderMethodKeys<TDefinition extends ProcedureDefinition, TDefaults> =
  | (HasProcedureDefaults<TDefaults> extends true ? "defaults" : never)
  | (ExtractProcedureAdapterMode<TDefaults> extends "route" ? "nextPage" : never)
  | (HasProcedureRoute<TDefinition> extends true ? "forRoute" : never)
  | (HasProcedureOutput<TDefinition> extends true ? "output" : never)
  | (HasProcedureInputContractTarget<TDefinition, "params"> extends true ? "params" : never)
  | (HasProcedureInputContractTarget<TDefinition, "query"> extends true ? "query" : never)
  | (HasProcedureInputContractTarget<TDefinition, "headers"> extends true ? "headers" : never)
  | (HasProcedureInputContractTarget<TDefinition, "cookies"> extends true ? "cookies" : never)
  | (HasProcedureInputContractTarget<TDefinition, "json"> extends true
      ? "json" | "formData"
      : never)
  | (HasProcedureInputContractTarget<TDefinition, "formData"> extends true
      ? "json" | "formData"
      : never);

export type ProcedureBuilder<
  TDefinition extends ProcedureDefinition = EmptyProcedureDefinition,
  TContext extends object = Record<never, never>,
  TDefaults = undefined,
  TErrorCatalog extends RpcErrorCatalog = DefaultRpcErrorCatalog,
  TMiddlewareTerminalResult = never,
> = Omit<
  ProcedureBuilderMethods<
    TDefinition,
    TContext,
    TDefaults,
    TErrorCatalog,
    TMiddlewareTerminalResult
  >,
  UsedProcedureBuilderMethodKeys<TDefinition, TDefaults>
>;

interface ProcedureBuilderMethods<
  TDefinition extends ProcedureDefinition = EmptyProcedureDefinition,
  TContext extends object = Record<never, never>,
  TDefaults = undefined,
  TErrorCatalog extends RpcErrorCatalog = DefaultRpcErrorCatalog,
  TMiddlewareTerminalResult = never,
> {
  errors<const TNextErrorCatalog extends RpcErrorCatalog>(
    errorCatalog: TNextErrorCatalog,
  ): ProcedureBuilder<
    TDefinition,
    TContext,
    TDefaults,
    TNextErrorCatalog,
    TMiddlewareTerminalResult
  >;

  defaults<const TSharedDefaults>(
    defaults: ProcedureDefaultsArg<TSharedDefaults, TErrorCatalog>,
  ): ProcedureBuilder<
    TDefinition,
    TContext,
    TSharedDefaults,
    TErrorCatalog,
    TMiddlewareTerminalResult
  >;

  meta<TMeta extends RpcMeta>(
    meta: TMeta,
  ): ProcedureBuilder<
    MergeProcedureDefinition<TDefinition, { meta: TMeta }>,
    TContext,
    TDefaults,
    TErrorCatalog,
    TMiddlewareTerminalResult
  >;

  forRoute<TRouteContract extends ProcedureRouteContract>(
    routeContract: TRouteContract,
  ): ProcedureBuilder<
    MergeProcedureDefinition<
      TDefinition,
      {
        route: ProcedureRouteBinding<TRouteContract["pathname"], TRouteContract["params"]>;
      }
    >,
    TContext,
    TDefaults,
    TErrorCatalog,
    TMiddlewareTerminalResult
  >;

  params<
    TSchema extends StandardSchemaV1,
    TOnValidationErrorResult extends ProcedureValidationErrorHandlerResult = never,
  >(
    schema: BoundRouteParamsSchemaArg<TDefinition, TSchema>,
    options?: ProcedureInputOptions<
      "params",
      InferSchemaInput<TSchema>,
      TOnValidationErrorResult,
      TErrorCatalog
    >,
  ): ProcedureBuilder<
    ExtendProcedureInputDefinition<TDefinition, "params", TSchema, TOnValidationErrorResult>,
    TContext,
    TDefaults,
    TErrorCatalog,
    TMiddlewareTerminalResult
  >;

  query<
    TSchema extends StandardSchemaV1,
    TOnValidationErrorResult extends ProcedureValidationErrorHandlerResult = never,
  >(
    schema: TSchema,
    options?: ProcedureInputOptions<
      "query",
      InferSchemaInput<TSchema>,
      TOnValidationErrorResult,
      TErrorCatalog
    >,
  ): ProcedureBuilder<
    ExtendProcedureInputDefinition<TDefinition, "query", TSchema, TOnValidationErrorResult>,
    TContext,
    TDefaults,
    TErrorCatalog,
    TMiddlewareTerminalResult
  >;

  json<
    TSchema extends StandardSchemaV1,
    TOnValidationErrorResult extends ProcedureValidationErrorHandlerResult = never,
  >(
    schema: BodyContractSchemaArg<TDefinition, "json", TSchema>,
    options?: ProcedureInputOptions<
      "json",
      InferSchemaInput<TSchema>,
      TOnValidationErrorResult,
      TErrorCatalog
    >,
  ): ProcedureBuilder<
    ExtendProcedureInputDefinition<TDefinition, "json", TSchema, TOnValidationErrorResult>,
    TContext,
    TDefaults,
    TErrorCatalog,
    TMiddlewareTerminalResult
  >;

  formData<
    TSchema extends StandardSchemaV1,
    TOnValidationErrorResult extends ProcedureValidationErrorHandlerResult = never,
  >(
    schema: BodyContractSchemaArg<TDefinition, "formData", TSchema>,
    options?: ProcedureInputOptions<
      "formData",
      InferSchemaInput<TSchema>,
      TOnValidationErrorResult,
      TErrorCatalog
    >,
  ): ProcedureBuilder<
    ExtendProcedureInputDefinition<TDefinition, "formData", TSchema, TOnValidationErrorResult>,
    TContext,
    TDefaults,
    TErrorCatalog,
    TMiddlewareTerminalResult
  >;

  headers<
    TSchema extends StandardSchemaV1,
    TOnValidationErrorResult extends ProcedureValidationErrorHandlerResult = never,
  >(
    schema: TSchema,
    options?: ProcedureInputOptions<
      "headers",
      InferSchemaInput<TSchema>,
      TOnValidationErrorResult,
      TErrorCatalog
    >,
  ): ProcedureBuilder<
    ExtendProcedureInputDefinition<TDefinition, "headers", TSchema, TOnValidationErrorResult>,
    TContext,
    TDefaults,
    TErrorCatalog,
    TMiddlewareTerminalResult
  >;

  cookies<
    TSchema extends StandardSchemaV1,
    TOnValidationErrorResult extends ProcedureValidationErrorHandlerResult = never,
  >(
    schema: TSchema,
    options?: ProcedureInputOptions<
      "cookies",
      InferSchemaInput<TSchema>,
      TOnValidationErrorResult,
      TErrorCatalog
    >,
  ): ProcedureBuilder<
    ExtendProcedureInputDefinition<TDefinition, "cookies", TSchema, TOnValidationErrorResult>,
    TContext,
    TDefaults,
    TErrorCatalog,
    TMiddlewareTerminalResult
  >;

  output<TOutput>(): ProcedureBuilder<
    MergeProcedureDefinition<
      TDefinition,
      {
        output: ProcedureOutputContract<TOutput>;
      }
    >,
    TContext,
    TDefaults,
    TErrorCatalog,
    TMiddlewareTerminalResult
  >;

  output<TSchema, TOutput = InferSchemaOutput<TSchema>>(
    schema: TSchema,
  ): ProcedureBuilder<
    MergeProcedureDefinition<
      TDefinition,
      {
        output: ProcedureOutputContract<TOutput>;
      }
    >,
    TContext,
    TDefaults,
    TErrorCatalog,
    TMiddlewareTerminalResult
  >;

  use<
    TMiddleware extends ProcedureMiddleware<
      ExtractValidationSchema<TDefinition>,
      InferProcedureParams<TDefinition>,
      TContext,
      object,
      TErrorCatalog,
      ExtractProcedureAdapterMode<TDefaults>
    >,
  >(
    middleware: TMiddleware,
  ): ProcedureBuilder<
    MergeProcedureDefinitionWithMiddleware<TDefinition, TMiddleware>,
    TContext & ExtractProcedureMiddlewareContextExtension<TMiddleware>,
    TDefaults,
    TErrorCatalog,
    TMiddlewareTerminalResult | ExtractProcedureMiddlewareTerminalResult<TMiddleware>
  >;

  handle<
    THandler extends ProcedureHandler<
      ExtractValidationSchema<TDefinition>,
      InferProcedureParams<TDefinition>,
      TContext,
      ExtractProcedureOutput<TDefinition>,
      TErrorCatalog,
      ExtractProcedureAdapterMode<TDefaults>
    >,
  >(
    ...args: ProcedureHandleArgs<
      TDefinition,
      TContext,
      ExtractProcedureAdapterMode<TDefaults>,
      TErrorCatalog,
      THandler
    >
  ): Procedure<
    TDefinition,
    TContext,
    ExtractProcedureOutput<TDefinition>,
    THandler,
    TDefaults,
    TErrorCatalog,
    TMiddlewareTerminalResult
  >;

  nextPage: ProcedureBuilderNextPageMethod<
    TDefinition,
    TContext,
    TDefaults,
    TErrorCatalog,
    TMiddlewareTerminalResult
  >;
}

const createProcedureBuilder = <
  TDefinition extends ProcedureDefinition,
  TContext extends object,
  TDefaults,
  TErrorCatalog extends RpcErrorCatalog = DefaultRpcErrorCatalog,
  TMiddlewareTerminalResult = never,
>(
  definition: TDefinition,
  middlewares: readonly ProcedureMiddleware[] = [],
  defaults?: TDefaults,
  errorCatalog?: TErrorCatalog,
): ProcedureBuilder<TDefinition, TContext, TDefaults, TErrorCatalog, TMiddlewareTerminalResult> => {
  const resolvedErrorCatalog = errorCatalog ?? (defaultRpcErrorCatalog as unknown as TErrorCatalog);

  const withInputContract = <
    TTarget extends ProcedureInputTarget,
    TSchema extends StandardSchemaV1,
    TOnValidationErrorResult extends ProcedureValidationErrorHandlerResult = never,
  >(
    target: TTarget,
    schema: TSchema,
    options?: ProcedureInputOptions<
      TTarget,
      InferSchemaInput<TSchema>,
      TOnValidationErrorResult,
      TErrorCatalog
    >,
  ): ProcedureBuilder<
    ExtendProcedureInputDefinition<TDefinition, TTarget, TSchema, TOnValidationErrorResult>,
    TContext,
    TDefaults,
    TErrorCatalog,
    TMiddlewareTerminalResult
  > => {
    return createProcedureBuilder(
      withProcedureInputContract(
        definition,
        target,
        schema,
        options,
      ) as unknown as ExtendProcedureInputDefinition<
        TDefinition,
        TTarget,
        TSchema,
        TOnValidationErrorResult
      >,
      middlewares,
      defaults,
      resolvedErrorCatalog,
    );
  };

  const withErrors = <const TNextErrorCatalog extends RpcErrorCatalog>(
    nextErrorCatalog: TNextErrorCatalog,
  ): ProcedureBuilder<
    TDefinition,
    TContext,
    TDefaults,
    TNextErrorCatalog,
    TMiddlewareTerminalResult
  > => {
    return createProcedureBuilder(definition, middlewares, defaults, nextErrorCatalog);
  };

  const withDefaults = <const TSharedDefaults>(
    nextDefaults: ProcedureDefaultsArg<TSharedDefaults, TErrorCatalog>,
  ): ProcedureBuilder<
    TDefinition,
    TContext,
    TSharedDefaults,
    TErrorCatalog,
    TMiddlewareTerminalResult
  > => {
    if (defaults !== undefined) {
      throw new Error("Procedure defaults have already been declared.");
    }

    return createProcedureBuilder(
      definition,
      middlewares,
      nextDefaults as TSharedDefaults,
      resolvedErrorCatalog,
    );
  };

  const withMeta = <TMeta extends RpcMeta>(
    meta: TMeta,
  ): ProcedureBuilder<
    MergeProcedureDefinition<TDefinition, { meta: TMeta }>,
    TContext,
    TDefaults,
    TErrorCatalog,
    TMiddlewareTerminalResult
  > => {
    return createProcedureBuilder(
      withProcedureMeta(definition, meta),
      middlewares,
      defaults,
      resolvedErrorCatalog,
    );
  };

  const withRoute = <TRouteContract extends ProcedureRouteContract>(
    routeContract: TRouteContract,
  ): ProcedureBuilder<
    MergeProcedureDefinition<
      TDefinition,
      {
        route: ProcedureRouteBinding<TRouteContract["pathname"], TRouteContract["params"]>;
      }
    >,
    TContext,
    TDefaults,
    TErrorCatalog,
    TMiddlewareTerminalResult
  > => {
    return createProcedureBuilder(
      withProcedureRouteBinding(definition, routeContract),
      middlewares,
      defaults,
      resolvedErrorCatalog,
    );
  };

  const withParams = <
    TSchema extends StandardSchemaV1,
    TOnValidationErrorResult extends ProcedureValidationErrorHandlerResult = never,
  >(
    schema: BoundRouteParamsSchemaArg<TDefinition, TSchema>,
    options?: ProcedureInputOptions<
      "params",
      InferSchemaInput<TSchema>,
      TOnValidationErrorResult,
      TErrorCatalog
    >,
  ): ProcedureBuilder<
    ExtendProcedureInputDefinition<TDefinition, "params", TSchema, TOnValidationErrorResult>,
    TContext,
    TDefaults,
    TErrorCatalog,
    TMiddlewareTerminalResult
  > => {
    return withInputContract("params", schema as TSchema, options);
  };

  const withQuery = <
    TSchema extends StandardSchemaV1,
    TOnValidationErrorResult extends ProcedureValidationErrorHandlerResult = never,
  >(
    schema: TSchema,
    options?: ProcedureInputOptions<
      "query",
      InferSchemaInput<TSchema>,
      TOnValidationErrorResult,
      TErrorCatalog
    >,
  ): ProcedureBuilder<
    ExtendProcedureInputDefinition<TDefinition, "query", TSchema, TOnValidationErrorResult>,
    TContext,
    TDefaults,
    TErrorCatalog,
    TMiddlewareTerminalResult
  > => {
    return withInputContract("query", schema as TSchema, options);
  };

  const withJson = <
    TSchema extends StandardSchemaV1,
    TOnValidationErrorResult extends ProcedureValidationErrorHandlerResult = never,
  >(
    schema: BodyContractSchemaArg<TDefinition, "json", TSchema>,
    options?: ProcedureInputOptions<
      "json",
      InferSchemaInput<TSchema>,
      TOnValidationErrorResult,
      TErrorCatalog
    >,
  ): ProcedureBuilder<
    ExtendProcedureInputDefinition<TDefinition, "json", TSchema, TOnValidationErrorResult>,
    TContext,
    TDefaults,
    TErrorCatalog,
    TMiddlewareTerminalResult
  > => {
    return withInputContract("json", schema as TSchema, options);
  };

  const withFormData = <
    TSchema extends StandardSchemaV1,
    TOnValidationErrorResult extends ProcedureValidationErrorHandlerResult = never,
  >(
    schema: BodyContractSchemaArg<TDefinition, "formData", TSchema>,
    options?: ProcedureInputOptions<
      "formData",
      InferSchemaInput<TSchema>,
      TOnValidationErrorResult,
      TErrorCatalog
    >,
  ): ProcedureBuilder<
    ExtendProcedureInputDefinition<TDefinition, "formData", TSchema, TOnValidationErrorResult>,
    TContext,
    TDefaults,
    TErrorCatalog,
    TMiddlewareTerminalResult
  > => {
    return withInputContract("formData", schema as TSchema, options);
  };

  const withHeaders = <
    TSchema extends StandardSchemaV1,
    TOnValidationErrorResult extends ProcedureValidationErrorHandlerResult = never,
  >(
    schema: TSchema,
    options?: ProcedureInputOptions<
      "headers",
      InferSchemaInput<TSchema>,
      TOnValidationErrorResult,
      TErrorCatalog
    >,
  ): ProcedureBuilder<
    ExtendProcedureInputDefinition<TDefinition, "headers", TSchema, TOnValidationErrorResult>,
    TContext,
    TDefaults,
    TErrorCatalog,
    TMiddlewareTerminalResult
  > => {
    return withInputContract("headers", schema as TSchema, options);
  };

  const withCookies = <
    TSchema extends StandardSchemaV1,
    TOnValidationErrorResult extends ProcedureValidationErrorHandlerResult = never,
  >(
    schema: TSchema,
    options?: ProcedureInputOptions<
      "cookies",
      InferSchemaInput<TSchema>,
      TOnValidationErrorResult,
      TErrorCatalog
    >,
  ): ProcedureBuilder<
    ExtendProcedureInputDefinition<TDefinition, "cookies", TSchema, TOnValidationErrorResult>,
    TContext,
    TDefaults,
    TErrorCatalog,
    TMiddlewareTerminalResult
  > => {
    return withInputContract("cookies", schema as TSchema, options);
  };

  const withOutput = <TSchema, TOutput = InferSchemaOutput<TSchema>>(
    schema?: TSchema,
  ): ProcedureBuilder<
    MergeProcedureDefinition<TDefinition, { output: ProcedureOutputContract<TOutput> }>,
    TContext,
    TDefaults,
    TErrorCatalog,
    TMiddlewareTerminalResult
  > => {
    return createProcedureBuilder(
      withProcedureOutput<TDefinition, TOutput, TSchema>(definition, schema),
      middlewares,
      defaults,
      resolvedErrorCatalog,
    );
  };

  const withMiddleware = <
    TMiddleware extends ProcedureMiddleware<
      ExtractValidationSchema<TDefinition>,
      InferProcedureParams<TDefinition>,
      TContext,
      object,
      TErrorCatalog,
      ExtractProcedureAdapterMode<TDefaults>
    >,
  >(
    middleware: TMiddleware,
  ): ProcedureBuilder<
    MergeProcedureDefinitionWithMiddleware<TDefinition, TMiddleware>,
    TContext & ExtractProcedureMiddlewareContextExtension<TMiddleware>,
    TDefaults,
    TErrorCatalog,
    TMiddlewareTerminalResult | ExtractProcedureMiddlewareTerminalResult<TMiddleware>
  > => {
    return createProcedureBuilder(
      definition,
      [...middlewares, middleware as unknown as ProcedureMiddleware],
      defaults,
      resolvedErrorCatalog,
    ) as ProcedureBuilder<
      MergeProcedureDefinitionWithMiddleware<TDefinition, TMiddleware>,
      TContext & ExtractProcedureMiddlewareContextExtension<TMiddleware>,
      TDefaults,
      TErrorCatalog,
      TMiddlewareTerminalResult | ExtractProcedureMiddlewareTerminalResult<TMiddleware>
    >;
  };

  const resolveRouteDefaults = (options: unknown) => {
    if (!defaults || typeof defaults !== "object") {
      return options;
    }

    const hasOptionOnError =
      options !== null && typeof options === "object" && "onError" in options;
    const hasOptionOnValidationError =
      options !== null && typeof options === "object" && "onValidationError" in options;

    if ("route" in defaults && defaults.route) {
      const routeDefaults = defaults as ProcedureSharedDefaults;

      return {
        ...(options as object),
        onError: hasOptionOnError
          ? (options as { onError: ProcedureOnError }).onError
          : routeDefaults.route?.onError,
        onValidationError: hasOptionOnValidationError
          ? (options as { onValidationError: ProcedureValidationErrorHandler }).onValidationError
          : routeDefaults.route?.onValidationError,
      };
    }

    return options;
  };

  const resolvePageDefaults = (options: unknown) => {
    if (
      !defaults ||
      typeof defaults !== "object" ||
      !("page" in defaults) ||
      !(defaults as ProcedureSharedDefaults).page
    ) {
      return options;
    }

    const pageDefaults = defaults as ProcedureSharedDefaults;
    const hasOptionOnValidationError =
      options && typeof options === "object" && "onValidationError" in options;

    return {
      ...(options as object),
      onError:
        options && typeof options === "object" && "onError" in options
          ? (options as { onError: ProcedurePageOnError }).onError
          : pageDefaults.page?.onError,
      onValidationError: hasOptionOnValidationError
        ? (options as { onValidationError: ProcedurePageOnValidationError }).onValidationError
        : pageDefaults.page?.onValidationError,
    };
  };

  return {
    errors: withErrors,
    defaults: withDefaults,
    meta: withMeta,
    forRoute: withRoute,
    params: withParams,
    query: withQuery,
    json: withJson,
    formData: withFormData,
    headers: withHeaders,
    cookies: withCookies,
    output: withOutput,
    use: withMiddleware,
    nextPage: ((render: unknown, options: unknown) => {
      const pageProcedure = {
        definition,
        errorCatalog: resolvedErrorCatalog,
        middlewares,
        middlewareTerminalResult: undefined as TMiddlewareTerminalResult,
      } as ProcedureBuilderNextPageCarrier<TDefinition, TErrorCatalog, TMiddlewareTerminalResult>;

      return adaptProcedureToNextPage(
        pageProcedure as never,
        render as never,
        resolvePageDefaults(options ?? {}) as never,
      );
    }) as unknown as ProcedureBuilderNextPageMethod<
      TDefinition,
      TContext,
      TDefaults,
      TErrorCatalog,
      TMiddlewareTerminalResult
    >,
    handle: (...args) => {
      const handledProcedure = {
        definition,
        errorCatalog: resolvedErrorCatalog,
        middlewares,
        handler: args[0],
        middlewareTerminalResult: undefined as TMiddlewareTerminalResult,
        nextRoute: ((options: unknown) =>
          adaptProcedureToNextRoute(
            handledProcedure as never,
            resolveRouteDefaults(options) as never,
          )) as ProcedureNextRouteMethod<
          TDefinition,
          TContext,
          ExtractProcedureOutput<TDefinition>,
          (typeof args)[0],
          TDefaults,
          TErrorCatalog,
          TMiddlewareTerminalResult
        >,
        nextPage: ((render: unknown, options: unknown) =>
          adaptProcedureToNextPage(
            handledProcedure as never,
            render as never,
            resolvePageDefaults(options ?? {}) as never,
          )) as unknown as ProcedureNextPageMethod<
          TDefinition,
          TContext,
          ExtractProcedureOutput<TDefinition>,
          (typeof args)[0],
          TDefaults,
          TErrorCatalog,
          TMiddlewareTerminalResult
        >,
      } as Procedure<
        TDefinition,
        TContext,
        ExtractProcedureOutput<TDefinition>,
        (typeof args)[0],
        TDefaults,
        TErrorCatalog,
        TMiddlewareTerminalResult
      >;

      return handledProcedure;
    },
  } as ProcedureBuilderMethods<
    TDefinition,
    TContext,
    TDefaults,
    TErrorCatalog,
    TMiddlewareTerminalResult
  > as ProcedureBuilder<TDefinition, TContext, TDefaults, TErrorCatalog, TMiddlewareTerminalResult>;
};

export const procedure = createProcedureBuilder<
  EmptyProcedureDefinition,
  Record<never, never>,
  undefined
>({});
