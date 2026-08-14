import type { NextRequest, NextResponse } from "next/server";
import type { HttpMethod } from "rpc4next-shared";

import type { HttpStatusCode } from "../lib/http-status-code-types";
import type { RpcMeta } from "./meta";
import {
  nextRoute as adaptProcedureToNextRoute,
  type NextRouteExports,
  type NextRouteProcedureOptions,
} from "./next-route";
import type { ProcedureOnError } from "./on-error";
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
  type ProcedureValidationErrorResponseMap,
} from "./procedure-types";
import type { ValidationSchema } from "./route-types";
import type { InferSchemaInput, InferSchemaOutput } from "./schema-inference";
import type { StandardSchemaV1 } from "./standard-schema";
import type { Params, Query, ResponseHelpers } from "./types";

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
    infer TContextExtension
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
  THandler extends ProcedureHandler<
    ExtractValidationSchema<TDefinition>,
    InferProcedureParams<TDefinition>,
    TContext,
    ExtractProcedureOutput<TDefinition>
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

export type ProcedureResponseHelpers<TOutput = unknown> = ResponseHelpers<TOutput>;

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
> = ProcedureValidatedContext<TValidationSchema, TBoundParams> & {
  request: NextRequest;
  ctx: TContext;
  response: ProcedureResponseHelpers<TOutput>;
};

export type ProcedureMiddlewareContext<
  TValidationSchema extends ValidationSchema = ValidationSchema,
  TBoundParams = Params,
  TContext extends object = Record<never, never>,
> = ProcedureValidatedContext<TValidationSchema, TBoundParams> & {
  request: NextRequest;
  ctx: TContext;
  response: ResponseHelpers;
};

export type ProcedureMiddlewareResult<TContextExtension extends object = Record<never, never>> =
  | undefined
  | Response
  | NextResponse
  | ProcedureResult
  | { ctx: TContextExtension };

export type ProcedureMiddleware<
  TValidationSchema extends ValidationSchema = ValidationSchema,
  TBoundParams = Params,
  TContext extends object = Record<never, never>,
  TContextExtension extends object = Record<never, never>,
> = (
  context: ProcedureMiddlewareContext<TValidationSchema, TBoundParams, TContext>,
) =>
  | Promise<ProcedureMiddlewareResult<TContextExtension>>
  | ProcedureMiddlewareResult<TContextExtension>;

export type ProcedureHandlerResult<TOutput = unknown> =
  | Response
  | NextResponse
  | ProcedureResult<TOutput>
  | Promise<Response | NextResponse | ProcedureResult<TOutput>>;

export type ProcedureHandler<
  TValidationSchema extends ValidationSchema = ValidationSchema,
  TBoundParams = Params,
  TContext extends object = Record<never, never>,
  TOutput = unknown,
> = (
  context: ProcedureHandlerContext<TValidationSchema, TBoundParams, TContext, TOutput>,
) => ProcedureHandlerResult<TOutput>;

type ProcedureSharedDefaults<TSharedOnError extends ProcedureOnError = ProcedureOnError> = {
  onError: TSharedOnError;
};

type ExtractProcedureSharedOnError<TDefaults> =
  TDefaults extends ProcedureSharedDefaults<infer TSharedOnError>
    ? TSharedOnError
    : ProcedureOnError;

type ProcedureNextRouteOptions<
  TDefinition extends ProcedureDefinition,
  TContext extends object,
  TOutput,
  THandler extends ProcedureHandler<
    ExtractValidationSchema<TDefinition>,
    InferProcedureParams<TDefinition>,
    TContext,
    TOutput
  >,
  TMethod extends HttpMethod,
  TValidateOutput extends boolean,
  TDefaults,
  TOnError extends ProcedureOnError,
  TMiddlewareTerminalResult,
> = TDefaults extends ProcedureSharedDefaults
  ? Omit<
      NextRouteProcedureOptions<
        Procedure<TDefinition, TContext, TOutput, THandler, TDefaults, TMiddlewareTerminalResult>,
        TMethod,
        TValidateOutput,
        TOnError
      >,
      "onError"
    > & {
      onError?: TOnError;
    }
  : NextRouteProcedureOptions<
      Procedure<TDefinition, TContext, TOutput, THandler, TDefaults, TMiddlewareTerminalResult>,
      TMethod,
      TValidateOutput,
      TOnError
    >;

export interface Procedure<
  TDefinition extends ProcedureDefinition = EmptyProcedureDefinition,
  TContext extends object = Record<never, never>,
  TOutput = ExtractProcedureOutput<TDefinition>,
  THandler extends ProcedureHandler<
    ExtractValidationSchema<TDefinition>,
    InferProcedureParams<TDefinition>,
    TContext,
    TOutput
  > = ProcedureHandler<
    ExtractValidationSchema<TDefinition>,
    InferProcedureParams<TDefinition>,
    TContext,
    TOutput
  >,
  TDefaults = undefined,
  TMiddlewareTerminalResult = never,
> {
  readonly definition: TDefinition;
  readonly middlewares: readonly ProcedureMiddleware[];
  readonly handler: THandler;
  readonly middlewareTerminalResult: TMiddlewareTerminalResult;
  nextRoute<
    TMethod extends HttpMethod = HttpMethod,
    TValidateOutput extends boolean = false,
    TOnError extends ProcedureOnError = ExtractProcedureSharedOnError<TDefaults>,
  >(
    options: ProcedureNextRouteOptions<
      TDefinition,
      TContext,
      TOutput,
      THandler,
      TMethod,
      TValidateOutput,
      TDefaults,
      TOnError,
      TMiddlewareTerminalResult
    >,
  ): NextRouteExports<
    Procedure<TDefinition, TContext, TOutput, THandler, TDefaults, TMiddlewareTerminalResult>,
    TMethod,
    TValidateOutput,
    TOnError
  >;
}

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

type UsedProcedureBuilderMethodKeys<TDefinition extends ProcedureDefinition, TDefaults> =
  | (HasProcedureDefaults<TDefaults> extends true ? "defaults" : never)
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
  TMiddlewareTerminalResult = never,
> = Omit<
  ProcedureBuilderMethods<TDefinition, TContext, TDefaults, TMiddlewareTerminalResult>,
  UsedProcedureBuilderMethodKeys<TDefinition, TDefaults>
>;

interface ProcedureBuilderMethods<
  TDefinition extends ProcedureDefinition = EmptyProcedureDefinition,
  TContext extends object = Record<never, never>,
  TDefaults = undefined,
  TMiddlewareTerminalResult = never,
> {
  defaults<TSharedOnError extends ProcedureOnError>(defaults: {
    onError: TSharedOnError;
  }): ProcedureBuilder<
    TDefinition,
    TContext,
    ProcedureSharedDefaults<TSharedOnError>,
    TMiddlewareTerminalResult
  >;

  meta<TMeta extends RpcMeta>(
    meta: TMeta,
  ): ProcedureBuilder<
    MergeProcedureDefinition<TDefinition, { meta: TMeta }>,
    TContext,
    TDefaults,
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
    TMiddlewareTerminalResult
  >;

  params<
    TSchema extends StandardSchemaV1,
    TOnValidationErrorResult extends ProcedureValidationErrorHandlerResult = never,
  >(
    schema: BoundRouteParamsSchemaArg<TDefinition, TSchema>,
    options?: ProcedureInputOptions<"params", InferSchemaInput<TSchema>, TOnValidationErrorResult>,
  ): ProcedureBuilder<
    ExtendProcedureInputDefinition<TDefinition, "params", TSchema, TOnValidationErrorResult>,
    TContext,
    TDefaults,
    TMiddlewareTerminalResult
  >;

  query<
    TSchema extends StandardSchemaV1,
    TOnValidationErrorResult extends ProcedureValidationErrorHandlerResult = never,
  >(
    schema: TSchema,
    options?: ProcedureInputOptions<"query", InferSchemaInput<TSchema>, TOnValidationErrorResult>,
  ): ProcedureBuilder<
    ExtendProcedureInputDefinition<TDefinition, "query", TSchema, TOnValidationErrorResult>,
    TContext,
    TDefaults,
    TMiddlewareTerminalResult
  >;

  json<
    TSchema extends StandardSchemaV1,
    TOnValidationErrorResult extends ProcedureValidationErrorHandlerResult = never,
  >(
    schema: BodyContractSchemaArg<TDefinition, "json", TSchema>,
    options?: ProcedureInputOptions<"json", InferSchemaInput<TSchema>, TOnValidationErrorResult>,
  ): ProcedureBuilder<
    ExtendProcedureInputDefinition<TDefinition, "json", TSchema, TOnValidationErrorResult>,
    TContext,
    TDefaults,
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
      TOnValidationErrorResult
    >,
  ): ProcedureBuilder<
    ExtendProcedureInputDefinition<TDefinition, "formData", TSchema, TOnValidationErrorResult>,
    TContext,
    TDefaults,
    TMiddlewareTerminalResult
  >;

  headers<
    TSchema extends StandardSchemaV1,
    TOnValidationErrorResult extends ProcedureValidationErrorHandlerResult = never,
  >(
    schema: TSchema,
    options?: ProcedureInputOptions<"headers", InferSchemaInput<TSchema>, TOnValidationErrorResult>,
  ): ProcedureBuilder<
    ExtendProcedureInputDefinition<TDefinition, "headers", TSchema, TOnValidationErrorResult>,
    TContext,
    TDefaults,
    TMiddlewareTerminalResult
  >;

  cookies<
    TSchema extends StandardSchemaV1,
    TOnValidationErrorResult extends ProcedureValidationErrorHandlerResult = never,
  >(
    schema: TSchema,
    options?: ProcedureInputOptions<"cookies", InferSchemaInput<TSchema>, TOnValidationErrorResult>,
  ): ProcedureBuilder<
    ExtendProcedureInputDefinition<TDefinition, "cookies", TSchema, TOnValidationErrorResult>,
    TContext,
    TDefaults,
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
    TMiddlewareTerminalResult
  >;

  use<
    TMiddleware extends ProcedureMiddleware<
      ExtractValidationSchema<TDefinition>,
      InferProcedureParams<TDefinition>,
      TContext,
      object
    >,
  >(
    middleware: TMiddleware,
  ): ProcedureBuilder<
    MergeProcedureDefinitionWithMiddleware<TDefinition, TMiddleware>,
    TContext & ExtractProcedureMiddlewareContextExtension<TMiddleware>,
    TDefaults,
    TMiddlewareTerminalResult | ExtractProcedureMiddlewareTerminalResult<TMiddleware>
  >;

  handle<
    THandler extends ProcedureHandler<
      ExtractValidationSchema<TDefinition>,
      InferProcedureParams<TDefinition>,
      TContext,
      ExtractProcedureOutput<TDefinition>
    >,
  >(
    ...args: ProcedureHandleArgs<TDefinition, TContext, THandler>
  ): Procedure<
    TDefinition,
    TContext,
    ExtractProcedureOutput<TDefinition>,
    THandler,
    TDefaults,
    TMiddlewareTerminalResult
  >;
}

const createProcedureBuilder = <
  TDefinition extends ProcedureDefinition,
  TContext extends object,
  TDefaults,
  TMiddlewareTerminalResult = never,
>(
  definition: TDefinition,
  middlewares: readonly ProcedureMiddleware[] = [],
  defaults?: TDefaults,
): ProcedureBuilder<TDefinition, TContext, TDefaults, TMiddlewareTerminalResult> => {
  const withInputContract = <
    TTarget extends ProcedureInputTarget,
    TSchema extends StandardSchemaV1,
    TOnValidationErrorResult extends ProcedureValidationErrorHandlerResult = never,
  >(
    target: TTarget,
    schema: TSchema,
    options?: ProcedureInputOptions<TTarget, InferSchemaInput<TSchema>, TOnValidationErrorResult>,
  ): ProcedureBuilder<
    ExtendProcedureInputDefinition<TDefinition, TTarget, TSchema, TOnValidationErrorResult>,
    TContext,
    TDefaults,
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
    );
  };

  const withDefaults = <TSharedOnError extends ProcedureOnError>(
    nextDefaults: ProcedureSharedDefaults<TSharedOnError>,
  ): ProcedureBuilder<
    TDefinition,
    TContext,
    ProcedureSharedDefaults<TSharedOnError>,
    TMiddlewareTerminalResult
  > => {
    if (defaults !== undefined) {
      throw new Error("Procedure defaults have already been declared.");
    }

    return createProcedureBuilder(definition, middlewares, nextDefaults);
  };

  const withMeta = <TMeta extends RpcMeta>(
    meta: TMeta,
  ): ProcedureBuilder<
    MergeProcedureDefinition<TDefinition, { meta: TMeta }>,
    TContext,
    TDefaults,
    TMiddlewareTerminalResult
  > => {
    return createProcedureBuilder(withProcedureMeta(definition, meta), middlewares, defaults);
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
    TMiddlewareTerminalResult
  > => {
    return createProcedureBuilder(
      withProcedureRouteBinding(definition, routeContract),
      middlewares,
      defaults,
    );
  };

  const withParams = <
    TSchema extends StandardSchemaV1,
    TOnValidationErrorResult extends ProcedureValidationErrorHandlerResult = never,
  >(
    schema: BoundRouteParamsSchemaArg<TDefinition, TSchema>,
    options?: ProcedureInputOptions<"params", InferSchemaInput<TSchema>, TOnValidationErrorResult>,
  ): ProcedureBuilder<
    ExtendProcedureInputDefinition<TDefinition, "params", TSchema, TOnValidationErrorResult>,
    TContext,
    TDefaults,
    TMiddlewareTerminalResult
  > => {
    return withInputContract("params", schema as TSchema, options);
  };

  const withQuery = <
    TSchema extends StandardSchemaV1,
    TOnValidationErrorResult extends ProcedureValidationErrorHandlerResult = never,
  >(
    schema: TSchema,
    options?: ProcedureInputOptions<"query", InferSchemaInput<TSchema>, TOnValidationErrorResult>,
  ): ProcedureBuilder<
    ExtendProcedureInputDefinition<TDefinition, "query", TSchema, TOnValidationErrorResult>,
    TContext,
    TDefaults,
    TMiddlewareTerminalResult
  > => {
    return withInputContract("query", schema as TSchema, options);
  };

  const withJson = <
    TSchema extends StandardSchemaV1,
    TOnValidationErrorResult extends ProcedureValidationErrorHandlerResult = never,
  >(
    schema: BodyContractSchemaArg<TDefinition, "json", TSchema>,
    options?: ProcedureInputOptions<"json", InferSchemaInput<TSchema>, TOnValidationErrorResult>,
  ): ProcedureBuilder<
    ExtendProcedureInputDefinition<TDefinition, "json", TSchema, TOnValidationErrorResult>,
    TContext,
    TDefaults,
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
      TOnValidationErrorResult
    >,
  ): ProcedureBuilder<
    ExtendProcedureInputDefinition<TDefinition, "formData", TSchema, TOnValidationErrorResult>,
    TContext,
    TDefaults,
    TMiddlewareTerminalResult
  > => {
    return withInputContract("formData", schema as TSchema, options);
  };

  const withHeaders = <
    TSchema extends StandardSchemaV1,
    TOnValidationErrorResult extends ProcedureValidationErrorHandlerResult = never,
  >(
    schema: TSchema,
    options?: ProcedureInputOptions<"headers", InferSchemaInput<TSchema>, TOnValidationErrorResult>,
  ): ProcedureBuilder<
    ExtendProcedureInputDefinition<TDefinition, "headers", TSchema, TOnValidationErrorResult>,
    TContext,
    TDefaults,
    TMiddlewareTerminalResult
  > => {
    return withInputContract("headers", schema as TSchema, options);
  };

  const withCookies = <
    TSchema extends StandardSchemaV1,
    TOnValidationErrorResult extends ProcedureValidationErrorHandlerResult = never,
  >(
    schema: TSchema,
    options?: ProcedureInputOptions<"cookies", InferSchemaInput<TSchema>, TOnValidationErrorResult>,
  ): ProcedureBuilder<
    ExtendProcedureInputDefinition<TDefinition, "cookies", TSchema, TOnValidationErrorResult>,
    TContext,
    TDefaults,
    TMiddlewareTerminalResult
  > => {
    return withInputContract("cookies", schema as TSchema, options);
  };

  const withOutput = <TSchema, TOutput = InferSchemaOutput<TSchema>>(
    schema: TSchema,
  ): ProcedureBuilder<
    MergeProcedureDefinition<TDefinition, { output: ProcedureOutputContract<TOutput> }>,
    TContext,
    TDefaults,
    TMiddlewareTerminalResult
  > => {
    return createProcedureBuilder(
      withProcedureOutput<TDefinition, TOutput, TSchema>(definition, schema),
      middlewares,
      defaults,
    );
  };

  const withMiddleware = <
    TMiddleware extends ProcedureMiddleware<
      ExtractValidationSchema<TDefinition>,
      InferProcedureParams<TDefinition>,
      TContext,
      object
    >,
  >(
    middleware: TMiddleware,
  ): ProcedureBuilder<
    MergeProcedureDefinitionWithMiddleware<TDefinition, TMiddleware>,
    TContext & ExtractProcedureMiddlewareContextExtension<TMiddleware>,
    TDefaults,
    TMiddlewareTerminalResult | ExtractProcedureMiddlewareTerminalResult<TMiddleware>
  > => {
    return createProcedureBuilder(
      definition,
      [...middlewares, middleware as unknown as ProcedureMiddleware],
      defaults,
    ) as ProcedureBuilder<
      MergeProcedureDefinitionWithMiddleware<TDefinition, TMiddleware>,
      TContext & ExtractProcedureMiddlewareContextExtension<TMiddleware>,
      TDefaults,
      TMiddlewareTerminalResult | ExtractProcedureMiddlewareTerminalResult<TMiddleware>
    >;
  };

  return {
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
    handle: (...args) => {
      const handledProcedure = {
        definition,
        middlewares,
        handler: args[0],
        middlewareTerminalResult: undefined as TMiddlewareTerminalResult,
        nextRoute: ((options) =>
          adaptProcedureToNextRoute(
            handledProcedure as never,
            (defaults && typeof defaults === "object" && defaults !== null && "onError" in defaults
              ? {
                  ...options,
                  onError: options.onError ?? defaults.onError,
                }
              : options) as never,
          )) as Procedure<
          TDefinition,
          TContext,
          ExtractProcedureOutput<TDefinition>,
          (typeof args)[0],
          TDefaults,
          TMiddlewareTerminalResult
        >["nextRoute"],
      } as Procedure<
        TDefinition,
        TContext,
        ExtractProcedureOutput<TDefinition>,
        (typeof args)[0],
        TDefaults,
        TMiddlewareTerminalResult
      >;

      return handledProcedure;
    },
  } as ProcedureBuilderMethods<
    TDefinition,
    TContext,
    TDefaults,
    TMiddlewareTerminalResult
  > as ProcedureBuilder<TDefinition, TContext, TDefaults, TMiddlewareTerminalResult>;
};

export const procedure = createProcedureBuilder<
  EmptyProcedureDefinition,
  Record<never, never>,
  undefined
>({});
