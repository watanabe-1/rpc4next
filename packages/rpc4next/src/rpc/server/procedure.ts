import type { NextRequest, NextResponse } from "next/server";
import type { HttpStatusCode } from "../lib/http-status-code-types";
import type { RpcMeta } from "./meta";
import type {
  MergeProcedureDefinition,
  ProcedureDefinition,
  ProcedureInputContract,
  ProcedureInputTarget,
  ProcedureOutputContract,
} from "./procedure-types";
import type { ValidationSchema } from "./route-types";
import type { Params, Query } from "./types";

type InferSchemaInput<TSchema> = TSchema extends { _input: infer TInput }
  ? TInput
  : TSchema extends { input: infer TInput }
    ? TInput
    : unknown;

type InferSchemaOutput<TSchema> = TSchema extends { _output: infer TOutput }
  ? TOutput
  : TSchema extends { _type: infer TOutput }
    ? TOutput
    : TSchema extends { output: infer TOutput }
      ? TOutput
      : unknown;

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
  TSchema,
> = MergeProcedureDefinition<
  TDefinition,
  {
    input: ProcedureInputContract<
      ExtendValidationSchema<
        ExtractValidationSchema<TDefinition>,
        TTarget,
        TSchema
      >
    > & {
      contracts: NonNullable<TDefinition["input"]>["contracts"] &
        Record<TTarget, TSchema>;
    };
  }
>;

export type ProcedureResult<TBody = unknown> = {
  status?: HttpStatusCode;
  headers?: HeadersInit;
  body?: TBody;
  redirect?: string;
};

export type ProcedureHandlerContext<
  TValidationSchema extends ValidationSchema = ValidationSchema,
  TContext extends object = Record<never, never>,
> = {
  request: NextRequest;
  params: ProcedureValueFor<TValidationSchema, "params", Params>;
  query: ProcedureValueFor<TValidationSchema, "query", Query>;
  json: ProcedureValueFor<TValidationSchema, "json", undefined>;
  headers: ProcedureValueFor<TValidationSchema, "headers", undefined>;
  cookies: ProcedureValueFor<TValidationSchema, "cookies", undefined>;
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
  TContext extends object = Record<never, never>,
  TContextExtension extends object = Record<never, never>,
> = (
  context: ProcedureHandlerContext<TValidationSchema, TContext>,
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
  TContext extends object = Record<never, never>,
  TOutput = unknown,
> = (
  context: ProcedureHandlerContext<TValidationSchema, TContext>,
) => ProcedureHandlerResult<TOutput>;

export interface Procedure<
  TDefinition extends ProcedureDefinition = ProcedureDefinition,
  TContext extends object = Record<never, never>,
  TOutput = ExtractProcedureOutput<TDefinition>,
  THandler extends ProcedureHandler<
    ExtractValidationSchema<TDefinition>,
    TContext,
    TOutput
  > = ProcedureHandler<ExtractValidationSchema<TDefinition>, TContext, TOutput>,
> {
  readonly definition: TDefinition;
  readonly middlewares: readonly ProcedureMiddleware[];
  readonly handler: THandler;
}

export interface ProcedureBuilder<
  TDefinition extends ProcedureDefinition = ProcedureDefinition,
  TContext extends object = Record<never, never>,
> {
  meta<TMeta extends RpcMeta>(
    meta: TMeta,
  ): ProcedureBuilder<
    MergeProcedureDefinition<TDefinition, { meta: TMeta }>,
    TContext
  >;

  params<TSchema>(
    schema: TSchema,
  ): ProcedureBuilder<
    ExtendProcedureInputDefinition<TDefinition, "params", TSchema>,
    TContext
  >;

  query<TSchema>(
    schema: TSchema,
  ): ProcedureBuilder<
    ExtendProcedureInputDefinition<TDefinition, "query", TSchema>,
    TContext
  >;

  json<TSchema>(
    schema: TSchema,
  ): ProcedureBuilder<
    ExtendProcedureInputDefinition<TDefinition, "json", TSchema>,
    TContext
  >;

  headers<TSchema>(
    schema: TSchema,
  ): ProcedureBuilder<
    ExtendProcedureInputDefinition<TDefinition, "headers", TSchema>,
    TContext
  >;

  cookies<TSchema>(
    schema: TSchema,
  ): ProcedureBuilder<
    ExtendProcedureInputDefinition<TDefinition, "cookies", TSchema>,
    TContext
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
    TContext
  >;

  use<TContextExtension extends object>(
    middleware: ProcedureMiddleware<
      ExtractValidationSchema<TDefinition>,
      TContext,
      TContextExtension
    >,
  ): ProcedureBuilder<TDefinition, TContext & TContextExtension>;

  handle<
    THandler extends ProcedureHandler<
      ExtractValidationSchema<TDefinition>,
      TContext,
      ExtractProcedureOutput<TDefinition>
    >,
  >(
    handler: THandler,
  ): Procedure<
    TDefinition,
    TContext,
    ExtractProcedureOutput<TDefinition>,
    THandler
  >;
}

const createProcedureBuilder = <
  TDefinition extends ProcedureDefinition,
  TContext extends object,
>(
  definition: TDefinition,
  middlewares: readonly ProcedureMiddleware[] = [],
): ProcedureBuilder<TDefinition, TContext> => {
  const withInputContract = <TTarget extends ProcedureInputTarget, TSchema>(
    target: TTarget,
    schema: TSchema,
  ): ProcedureBuilder<
    ExtendProcedureInputDefinition<TDefinition, TTarget, TSchema>,
    TContext
  > => {
    return createProcedureBuilder(
      {
        ...definition,
        input: {
          contracts: {
            ...(definition.input?.contracts ?? {}),
            [target]: schema,
          },
          validationSchema: {
            ...(definition.input?.validationSchema ?? {
              input: {},
              output: {},
            }),
          },
        },
      } as unknown as ExtendProcedureInputDefinition<
        TDefinition,
        TTarget,
        TSchema
      >,
      middlewares,
    );
  };

  const withMeta = <TMeta extends RpcMeta>(
    meta: TMeta,
  ): ProcedureBuilder<
    MergeProcedureDefinition<TDefinition, { meta: TMeta }>,
    TContext
  > => {
    return createProcedureBuilder(
      {
        ...definition,
        meta,
      } as MergeProcedureDefinition<TDefinition, { meta: TMeta }>,
      middlewares,
    );
  };

  const withOutput = <TSchema, TOutput = InferSchemaOutput<TSchema>>(
    schema: TSchema,
  ): ProcedureBuilder<
    MergeProcedureDefinition<
      TDefinition,
      { output: ProcedureOutputContract<TOutput> }
    >,
    TContext
  > => {
    return createProcedureBuilder(
      {
        ...definition,
        output: {
          schema,
        },
      } as MergeProcedureDefinition<
        TDefinition,
        { output: ProcedureOutputContract<TOutput> }
      >,
      middlewares,
    );
  };

  const withMiddleware = <TContextExtension extends object>(
    middleware: ProcedureMiddleware<
      ExtractValidationSchema<TDefinition>,
      TContext,
      TContextExtension
    >,
  ): ProcedureBuilder<TDefinition, TContext & TContextExtension> => {
    return createProcedureBuilder(definition, [
      ...middlewares,
      middleware as unknown as ProcedureMiddleware,
    ]) as ProcedureBuilder<TDefinition, TContext & TContextExtension>;
  };

  return {
    meta: withMeta,
    params: (schema) => withInputContract("params", schema),
    query: (schema) => withInputContract("query", schema),
    json: (schema) => withInputContract("json", schema),
    headers: (schema) => withInputContract("headers", schema),
    cookies: (schema) => withInputContract("cookies", schema),
    output: withOutput,
    use: withMiddleware,
    handle: (handler) =>
      ({
        definition,
        middlewares,
        handler,
      }) as Procedure<
        TDefinition,
        TContext,
        ExtractProcedureOutput<TDefinition>,
        typeof handler
      >,
  };
};

export const procedure = createProcedureBuilder<
  ProcedureDefinition,
  Record<never, never>
>({
  error: {},
});
