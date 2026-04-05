import type { NextRequest, NextResponse } from "next/server";
import type { HttpMethod } from "rpc4next-shared";
import type { HttpStatusCode } from "../lib/http-status-code-types";
import type { RpcMeta } from "./meta";
import {
  nextRoute as adaptProcedureToNextRoute,
  type NextRouteHandler,
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
  attachProcedureDefinition,
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
  type WithProcedureDefinition,
} from "./procedure-types";
import type { ValidationSchema } from "./route-types";
import type { InferSchemaInput, InferSchemaOutput } from "./schema-inference";
import type { StandardSchemaV1 } from "./standard-schema";
import type { Params, Query, ResponseHelpers } from "./types";

type ExtractValidationSchema<TDefinition extends ProcedureDefinition> =
  TDefinition extends ProcedureDefinition<
    infer _THttpMethod,
    infer TValidationSchema
  >
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

type MergeProcedureDefinitionWithMiddleware<
  TDefinition extends ProcedureDefinition,
  _TMiddleware,
> = TDefinition;

type ExtractBoundRouteParams<TDefinition extends ProcedureDefinition> =
  ExtractProcedureRouteBinding<TDefinition> extends ProcedureRouteBinding<
    string,
    infer TParams
  >
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
  input: TValidationSchema["input"] &
    Record<TTarget, InferSchemaInput<TSchema>>;
  output: TValidationSchema["output"] &
    Record<TTarget, InferSchemaOutput<TSchema>>;
};

type ExtendProcedureInputDefinition<
  TDefinition extends ProcedureDefinition,
  TTarget extends ProcedureInputTarget,
  TSchema extends StandardSchemaV1,
  TOnValidationErrorResult extends
    ProcedureValidationErrorHandlerResult = never,
> = MergeProcedureDefinition<
  TDefinition,
  {
    input: ProcedureInputContract<
      ExtendValidationSchema<
        ExtractValidationSchema<TDefinition>,
        TTarget,
        TSchema
      >,
      ExtractProcedureValidationErrorResponses<TDefinition> &
        Record<
          TTarget,
          InferProcedureValidationErrorRouteResponse<TOnValidationErrorResult>
        >
    > & {
      contracts: NonNullable<TDefinition["input"]>["contracts"] &
        Record<TTarget, TSchema>;
    };
  }
>;

type ExtractProcedureValidationErrorResponses<
  TDefinition extends ProcedureDefinition,
> = TDefinition extends {
  input: ProcedureInputContract<
    ValidationSchema,
    infer TValidationErrorResponses
  >;
}
  ? TValidationErrorResponses
  : Record<never, never>;

type InferProcedureValidationErrorRouteResponse<TOnValidationErrorResult> =
  Exclude<
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

export type ProcedureResponseHelpers<TOutput = unknown> =
  ResponseHelpers<TOutput>;

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
};

export type ProcedureMiddlewareResult<
  TContextExtension extends object = Record<never, never>,
> =
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
  context: ProcedureMiddlewareContext<
    TValidationSchema,
    TBoundParams,
    TContext
  >,
) =>
  | Promise<ProcedureMiddlewareResult<TContextExtension>>
  | ProcedureMiddlewareResult<TContextExtension>;

export type DeclaredProcedureMiddleware<
  TMiddleware extends (...args: never[]) => unknown = ProcedureMiddleware,
  TDefinition extends Partial<ProcedureDefinition> = Record<never, never>,
> = WithProcedureDefinition<TMiddleware, TDefinition>;

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
  context: ProcedureHandlerContext<
    TValidationSchema,
    TBoundParams,
    TContext,
    TOutput
  >,
) => ProcedureHandlerResult<TOutput>;

type ProcedureSharedDefaults<
  TSharedOnError extends ProcedureOnError = ProcedureOnError,
> = {
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
  TMethod extends HttpMethod | undefined,
  TValidateOutput extends boolean,
  TDefaults,
  TOnError extends ProcedureOnError,
> = TDefaults extends ProcedureSharedDefaults
  ? Omit<
      NextRouteProcedureOptions<
        Procedure<TDefinition, TContext, TOutput, THandler, TDefaults>,
        TMethod,
        TValidateOutput,
        TOnError
      >,
      "onError"
    > & {
      onError?: TOnError;
    }
  : NextRouteProcedureOptions<
      Procedure<TDefinition, TContext, TOutput, THandler, TDefaults>,
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
> {
  readonly definition: TDefinition;
  readonly middlewares: readonly ProcedureMiddleware[];
  readonly handler: THandler;
  nextRoute<
    TMethod extends HttpMethod | undefined = undefined,
    TValidateOutput extends boolean = false,
    TOnError extends
      ProcedureOnError = ExtractProcedureSharedOnError<TDefaults>,
  >(
    options: ProcedureNextRouteOptions<
      TDefinition,
      TContext,
      TOutput,
      THandler,
      TMethod,
      TValidateOutput,
      TDefaults,
      TOnError
    >,
  ): NextRouteHandler<
    Procedure<TDefinition, TContext, TOutput, THandler, TDefaults>,
    TMethod,
    TValidateOutput,
    TOnError
  >;
}

export interface ProcedureBuilder<
  TDefinition extends ProcedureDefinition = EmptyProcedureDefinition,
  TContext extends object = Record<never, never>,
  TDefaults = undefined,
> {
  defaults<TSharedOnError extends ProcedureOnError>(defaults: {
    onError: TSharedOnError;
  }): ProcedureBuilder<
    TDefinition,
    TContext,
    ProcedureSharedDefaults<TSharedOnError>
  >;

  meta<TMeta extends RpcMeta>(
    meta: TMeta,
  ): ProcedureBuilder<
    MergeProcedureDefinition<TDefinition, { meta: TMeta }>,
    TContext,
    TDefaults
  >;

  forRoute<TRouteContract extends ProcedureRouteContract>(
    routeContract: TRouteContract,
  ): ProcedureBuilder<
    MergeProcedureDefinition<
      TDefinition,
      {
        route: ProcedureRouteBinding<
          TRouteContract["pathname"],
          TRouteContract["params"]
        >;
      }
    >,
    TContext,
    TDefaults
  >;

  params<
    TSchema extends StandardSchemaV1,
    TOnValidationErrorResult extends
      ProcedureValidationErrorHandlerResult = never,
  >(
    schema: BoundRouteParamsSchemaArg<TDefinition, TSchema>,
    options?: ProcedureInputOptions<
      "params",
      InferSchemaInput<TSchema>,
      TOnValidationErrorResult
    >,
  ): ProcedureBuilder<
    ExtendProcedureInputDefinition<
      TDefinition,
      "params",
      TSchema,
      TOnValidationErrorResult
    >,
    TContext,
    TDefaults
  >;

  query<
    TSchema extends StandardSchemaV1,
    TOnValidationErrorResult extends
      ProcedureValidationErrorHandlerResult = never,
  >(
    schema: TSchema,
    options?: ProcedureInputOptions<
      "query",
      InferSchemaInput<TSchema>,
      TOnValidationErrorResult
    >,
  ): ProcedureBuilder<
    ExtendProcedureInputDefinition<
      TDefinition,
      "query",
      TSchema,
      TOnValidationErrorResult
    >,
    TContext,
    TDefaults
  >;

  json<
    TSchema extends StandardSchemaV1,
    TOnValidationErrorResult extends
      ProcedureValidationErrorHandlerResult = never,
  >(
    schema: BodyContractSchemaArg<TDefinition, "json", TSchema>,
    options?: ProcedureInputOptions<
      "json",
      InferSchemaInput<TSchema>,
      TOnValidationErrorResult
    >,
  ): ProcedureBuilder<
    ExtendProcedureInputDefinition<
      TDefinition,
      "json",
      TSchema,
      TOnValidationErrorResult
    >,
    TContext,
    TDefaults
  >;

  formData<
    TSchema extends StandardSchemaV1,
    TOnValidationErrorResult extends
      ProcedureValidationErrorHandlerResult = never,
  >(
    schema: BodyContractSchemaArg<TDefinition, "formData", TSchema>,
    options?: ProcedureInputOptions<
      "formData",
      InferSchemaInput<TSchema>,
      TOnValidationErrorResult
    >,
  ): ProcedureBuilder<
    ExtendProcedureInputDefinition<
      TDefinition,
      "formData",
      TSchema,
      TOnValidationErrorResult
    >,
    TContext,
    TDefaults
  >;

  headers<
    TSchema extends StandardSchemaV1,
    TOnValidationErrorResult extends
      ProcedureValidationErrorHandlerResult = never,
  >(
    schema: TSchema,
    options?: ProcedureInputOptions<
      "headers",
      InferSchemaInput<TSchema>,
      TOnValidationErrorResult
    >,
  ): ProcedureBuilder<
    ExtendProcedureInputDefinition<
      TDefinition,
      "headers",
      TSchema,
      TOnValidationErrorResult
    >,
    TContext,
    TDefaults
  >;

  cookies<
    TSchema extends StandardSchemaV1,
    TOnValidationErrorResult extends
      ProcedureValidationErrorHandlerResult = never,
  >(
    schema: TSchema,
    options?: ProcedureInputOptions<
      "cookies",
      InferSchemaInput<TSchema>,
      TOnValidationErrorResult
    >,
  ): ProcedureBuilder<
    ExtendProcedureInputDefinition<
      TDefinition,
      "cookies",
      TSchema,
      TOnValidationErrorResult
    >,
    TContext,
    TDefaults
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
    TDefaults
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
    TDefaults
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
    TDefaults
  >;
}

const createDeclaredProcedureMiddleware = <
  TMiddleware extends (...args: never[]) => unknown,
  TDefinition extends Partial<ProcedureDefinition>,
>(
  middleware: TMiddleware,
  definition: TDefinition,
): DeclaredProcedureMiddleware<TMiddleware, TDefinition> => {
  return attachProcedureDefinition(
    ((context) => middleware(context)) as TMiddleware,
    definition,
  ) as DeclaredProcedureMiddleware<TMiddleware, TDefinition>;
};

const createProcedureBuilder = <
  TDefinition extends ProcedureDefinition,
  TContext extends object,
  TDefaults,
>(
  definition: TDefinition,
  middlewares: readonly ProcedureMiddleware[] = [],
  defaults?: TDefaults,
): ProcedureBuilder<TDefinition, TContext, TDefaults> => {
  const withInputContract = <
    TTarget extends ProcedureInputTarget,
    TSchema extends StandardSchemaV1,
    TOnValidationErrorResult extends
      ProcedureValidationErrorHandlerResult = never,
  >(
    target: TTarget,
    schema: TSchema,
    options?: ProcedureInputOptions<
      TTarget,
      InferSchemaInput<TSchema>,
      TOnValidationErrorResult
    >,
  ): ProcedureBuilder<
    ExtendProcedureInputDefinition<
      TDefinition,
      TTarget,
      TSchema,
      TOnValidationErrorResult
    >,
    TContext,
    TDefaults
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
    ProcedureSharedDefaults<TSharedOnError>
  > => {
    return createProcedureBuilder(definition, middlewares, nextDefaults);
  };

  const withMeta = <TMeta extends RpcMeta>(
    meta: TMeta,
  ): ProcedureBuilder<
    MergeProcedureDefinition<TDefinition, { meta: TMeta }>,
    TContext,
    TDefaults
  > => {
    return createProcedureBuilder(
      withProcedureMeta(definition, meta),
      middlewares,
      defaults,
    );
  };

  const withRoute = <TRouteContract extends ProcedureRouteContract>(
    routeContract: TRouteContract,
  ): ProcedureBuilder<
    MergeProcedureDefinition<
      TDefinition,
      {
        route: ProcedureRouteBinding<
          TRouteContract["pathname"],
          TRouteContract["params"]
        >;
      }
    >,
    TContext,
    TDefaults
  > => {
    return createProcedureBuilder(
      withProcedureRouteBinding(definition, routeContract),
      middlewares,
      defaults,
    );
  };

  const withParams = <
    TSchema extends StandardSchemaV1,
    TOnValidationErrorResult extends
      ProcedureValidationErrorHandlerResult = never,
  >(
    schema: BoundRouteParamsSchemaArg<TDefinition, TSchema>,
    options?: ProcedureInputOptions<
      "params",
      InferSchemaInput<TSchema>,
      TOnValidationErrorResult
    >,
  ): ProcedureBuilder<
    ExtendProcedureInputDefinition<
      TDefinition,
      "params",
      TSchema,
      TOnValidationErrorResult
    >,
    TContext,
    TDefaults
  > => {
    return withInputContract("params", schema as TSchema, options);
  };

  const withJson = <
    TSchema extends StandardSchemaV1,
    TOnValidationErrorResult extends
      ProcedureValidationErrorHandlerResult = never,
  >(
    schema: BodyContractSchemaArg<TDefinition, "json", TSchema>,
    options?: ProcedureInputOptions<
      "json",
      InferSchemaInput<TSchema>,
      TOnValidationErrorResult
    >,
  ): ProcedureBuilder<
    ExtendProcedureInputDefinition<
      TDefinition,
      "json",
      TSchema,
      TOnValidationErrorResult
    >,
    TContext,
    TDefaults
  > => {
    return withInputContract("json", schema as TSchema, options);
  };

  const withFormData = <
    TSchema extends StandardSchemaV1,
    TOnValidationErrorResult extends
      ProcedureValidationErrorHandlerResult = never,
  >(
    schema: BodyContractSchemaArg<TDefinition, "formData", TSchema>,
    options?: ProcedureInputOptions<
      "formData",
      InferSchemaInput<TSchema>,
      TOnValidationErrorResult
    >,
  ): ProcedureBuilder<
    ExtendProcedureInputDefinition<
      TDefinition,
      "formData",
      TSchema,
      TOnValidationErrorResult
    >,
    TContext,
    TDefaults
  > => {
    return withInputContract("formData", schema as TSchema, options);
  };

  const withOutput = <TSchema, TOutput = InferSchemaOutput<TSchema>>(
    schema: TSchema,
  ): ProcedureBuilder<
    MergeProcedureDefinition<
      TDefinition,
      { output: ProcedureOutputContract<TOutput> }
    >,
    TContext,
    TDefaults
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
    TDefaults
  > => {
    return createProcedureBuilder(
      definition,
      [...middlewares, middleware as unknown as ProcedureMiddleware],
      defaults,
    ) as ProcedureBuilder<
      MergeProcedureDefinitionWithMiddleware<TDefinition, TMiddleware>,
      TContext & ExtractProcedureMiddlewareContextExtension<TMiddleware>,
      TDefaults
    >;
  };

  return {
    defaults: withDefaults,
    meta: withMeta,
    forRoute: withRoute,
    params: withParams,
    query: (schema, options) => withInputContract("query", schema, options),
    json: withJson,
    formData: withFormData,
    headers: (schema, options) => withInputContract("headers", schema, options),
    cookies: (schema, options) => withInputContract("cookies", schema, options),
    output: withOutput,
    use: withMiddleware,
    handle: (...args) => {
      const handledProcedure = {
        definition,
        middlewares,
        handler: args[0],
        nextRoute: ((options) =>
          adaptProcedureToNextRoute(
            handledProcedure as never,
            (defaults &&
            typeof defaults === "object" &&
            defaults !== null &&
            "onError" in defaults
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
          TDefaults
        >["nextRoute"],
      } as Procedure<
        TDefinition,
        TContext,
        ExtractProcedureOutput<TDefinition>,
        (typeof args)[0],
        TDefaults
      >;

      return handledProcedure;
    },
  };
};

export const procedure = createProcedureBuilder<
  EmptyProcedureDefinition,
  Record<never, never>,
  undefined
>({});

export const defineProcedureMiddleware = <
  TMiddleware extends (...args: never[]) => unknown,
>(
  middleware: TMiddleware,
): DeclaredProcedureMiddleware<TMiddleware> =>
  createDeclaredProcedureMiddleware(middleware, {});
