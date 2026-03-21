import type { NextRequest, NextResponse } from "next/server";
import type { HttpStatusCode } from "../lib/http-status-code-types";
import type { RpcErrorCode } from "./error";
import type { RpcMeta } from "./meta";
import {
  withProcedureError,
  withProcedureInputContract,
  withProcedureMeta,
  withProcedureOutput,
} from "./procedure-internals";
import type {
  MergeProcedureDefinition,
  ProcedureDefinition,
  ProcedureErrorContract,
  ProcedureInputContract,
  ProcedureInputTarget,
  ProcedureOutputContract,
} from "./procedure-types";
import type { ValidationSchema } from "./route-types";
import type { StandardSchemaV1 } from "./standard-schema";
import type { Params, Query } from "./types";

type InferSchemaInput<TSchema> = TSchema extends {
  readonly "~standard": { readonly types?: { readonly input: infer TInput } };
}
  ? TInput
  : TSchema extends { _input?: infer TInput }
    ? TInput
    : TSchema extends { input: infer TInput }
      ? TInput
      : unknown;

type InferSchemaOutput<TSchema> = TSchema extends {
  readonly "~standard": { readonly types?: { readonly output: infer TOutput } };
}
  ? TOutput
  : TSchema extends { _output?: infer TOutput }
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
  TSchema extends StandardSchemaV1,
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
  TDefinition extends ProcedureDefinition = Record<never, never>,
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
  TDefinition extends ProcedureDefinition = Record<never, never>,
  TContext extends object = Record<never, never>,
> {
  meta<TMeta extends RpcMeta>(
    meta: TMeta,
  ): ProcedureBuilder<
    MergeProcedureDefinition<TDefinition, { meta: TMeta }>,
    TContext
  >;

  params<TSchema extends StandardSchemaV1>(
    schema: TSchema,
  ): ProcedureBuilder<
    ExtendProcedureInputDefinition<TDefinition, "params", TSchema>,
    TContext
  >;

  query<TSchema extends StandardSchemaV1>(
    schema: TSchema,
  ): ProcedureBuilder<
    ExtendProcedureInputDefinition<TDefinition, "query", TSchema>,
    TContext
  >;

  json<TSchema extends StandardSchemaV1>(
    schema: TSchema,
  ): ProcedureBuilder<
    ExtendProcedureInputDefinition<TDefinition, "json", TSchema>,
    TContext
  >;

  headers<TSchema extends StandardSchemaV1>(
    schema: TSchema,
  ): ProcedureBuilder<
    ExtendProcedureInputDefinition<TDefinition, "headers", TSchema>,
    TContext
  >;

  cookies<TSchema extends StandardSchemaV1>(
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

  error<TCode extends RpcErrorCode, TDetails = unknown>(
    code: TCode,
  ): ProcedureBuilder<
    MergeProcedureDefinition<
      TDefinition,
      {
        error: ProcedureErrorContract<TCode, TDetails>;
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
  const withInputContract = <
    TTarget extends ProcedureInputTarget,
    TSchema extends StandardSchemaV1,
  >(
    target: TTarget,
    schema: TSchema,
  ): ProcedureBuilder<
    ExtendProcedureInputDefinition<TDefinition, TTarget, TSchema>,
    TContext
  > => {
    return createProcedureBuilder(
      withProcedureInputContract(
        definition,
        target,
        schema,
      ) as unknown as ExtendProcedureInputDefinition<
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
      withProcedureMeta(definition, meta),
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
      withProcedureOutput<TDefinition, TOutput, TSchema>(definition, schema),
      middlewares,
    );
  };

  const withError = <TCode extends RpcErrorCode, TDetails = unknown>(
    code: TCode,
  ): ProcedureBuilder<
    MergeProcedureDefinition<
      TDefinition,
      { error: ProcedureErrorContract<TCode, TDetails> }
    >,
    TContext
  > => {
    return createProcedureBuilder(
      withProcedureError<TDefinition, TCode, TDetails>(definition, code),
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
    error: withError,
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
  Record<never, never>,
  Record<never, never>
>({});
