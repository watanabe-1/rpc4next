import type { NextRequest, NextResponse } from "next/server";
import type { HttpStatusCode } from "../lib/http-status-code-types";
import type { RpcErrorCode } from "./error";
import type { RpcMeta } from "./meta";
import {
  withProcedureError,
  withProcedureInputContract,
  withProcedureMeta,
  withProcedureOutput,
  withProcedureRouteBinding,
} from "./procedure-internals";
import type {
  AppendProcedureErrorDefinition,
  EmptyProcedureDefinition,
  MergeProcedureDefinition,
  ProcedureDefinition,
  ProcedureErrorContract,
  ProcedureInputContract,
  ProcedureInputTarget,
  ProcedureOutputContract,
  ProcedureRouteBinding,
  ProcedureRouteContract,
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

type ExtractProcedureRouteBinding<TDefinition extends ProcedureDefinition> =
  TDefinition extends ProcedureDefinition<
    infer _THttpMethod,
    infer _TValidationSchema,
    infer _TRouteResponse,
    infer _TMeta,
    infer _TError,
    infer TRoute
  >
    ? TRoute
    : undefined;

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
> = ProcedureValidatedContext<TValidationSchema, TBoundParams> & {
  request: NextRequest;
  ctx: TContext;
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
  context: ProcedureHandlerContext<TValidationSchema, TBoundParams, TContext>,
) => ProcedureHandlerResult<TOutput>;

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
> {
  readonly definition: TDefinition;
  readonly middlewares: readonly ProcedureMiddleware[];
  readonly handler: THandler;
}

export interface ProcedureBuilder<
  TDefinition extends ProcedureDefinition = EmptyProcedureDefinition,
  TContext extends object = Record<never, never>,
> {
  meta<TMeta extends RpcMeta>(
    meta: TMeta,
  ): ProcedureBuilder<
    MergeProcedureDefinition<TDefinition, { meta: TMeta }>,
    TContext
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
    TContext
  >;

  params<TSchema extends StandardSchemaV1>(
    schema: BoundRouteParamsSchemaArg<TDefinition, TSchema>,
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
    schema: BodyContractSchemaArg<TDefinition, "json", TSchema>,
  ): ProcedureBuilder<
    ExtendProcedureInputDefinition<TDefinition, "json", TSchema>,
    TContext
  >;

  formData<TSchema extends StandardSchemaV1>(
    schema: BodyContractSchemaArg<TDefinition, "formData", TSchema>,
  ): ProcedureBuilder<
    ExtendProcedureInputDefinition<TDefinition, "formData", TSchema>,
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
    AppendProcedureErrorDefinition<
      TDefinition,
      ProcedureErrorContract<TCode, TDetails>
    >,
    TContext
  >;

  use<TContextExtension extends object>(
    middleware: ProcedureMiddleware<
      ExtractValidationSchema<TDefinition>,
      InferProcedureParams<TDefinition>,
      TContext,
      TContextExtension
    >,
  ): ProcedureBuilder<TDefinition, TContext & TContextExtension>;

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
    TContext
  > => {
    return createProcedureBuilder(
      withProcedureRouteBinding(definition, routeContract),
      middlewares,
    );
  };

  const withParams = <TSchema extends StandardSchemaV1>(
    schema: BoundRouteParamsSchemaArg<TDefinition, TSchema>,
  ): ProcedureBuilder<
    ExtendProcedureInputDefinition<TDefinition, "params", TSchema>,
    TContext
  > => {
    return withInputContract("params", schema as TSchema);
  };

  const withJson = <TSchema extends StandardSchemaV1>(
    schema: BodyContractSchemaArg<TDefinition, "json", TSchema>,
  ): ProcedureBuilder<
    ExtendProcedureInputDefinition<TDefinition, "json", TSchema>,
    TContext
  > => {
    return withInputContract("json", schema as TSchema);
  };

  const withFormData = <TSchema extends StandardSchemaV1>(
    schema: BodyContractSchemaArg<TDefinition, "formData", TSchema>,
  ): ProcedureBuilder<
    ExtendProcedureInputDefinition<TDefinition, "formData", TSchema>,
    TContext
  > => {
    return withInputContract("formData", schema as TSchema);
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
    AppendProcedureErrorDefinition<
      TDefinition,
      ProcedureErrorContract<TCode, TDetails>
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
      InferProcedureParams<TDefinition>,
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
    forRoute: withRoute,
    params: withParams,
    query: (schema) => withInputContract("query", schema),
    json: withJson,
    formData: withFormData,
    headers: (schema) => withInputContract("headers", schema),
    cookies: (schema) => withInputContract("cookies", schema),
    output: withOutput,
    error: withError,
    use: withMiddleware,
    handle: (...args) =>
      ({
        definition,
        middlewares,
        handler: args[0],
      }) as Procedure<
        TDefinition,
        TContext,
        ExtractProcedureOutput<TDefinition>,
        (typeof args)[0]
      >,
  };
};

export const procedure = createProcedureBuilder<
  EmptyProcedureDefinition,
  Record<never, never>
>({});
