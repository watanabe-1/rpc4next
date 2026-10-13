import type { NextRequest, NextResponse } from "next/server";
import type { HttpMethod } from "rpc4next-shared";

import type { DefaultRpcErrorCatalog, RpcErrorCatalog } from "./error";
import type { RpcMeta } from "./meta";
import type { ProcedureOnErrorResponse } from "./on-error";
import type { ProcedureResult } from "./procedure";
import type { procedureDefinitionSymbol } from "./procedure-definition";
import type { ValidationSchema } from "./route-types";
import type { StandardSchemaV1, StandardSchemaV1Issue } from "./standard-schema";

/** Request parts that a procedure can validate with a Standard Schema contract. */
export type ProcedureInputTarget = "params" | "query" | "json" | "formData" | "headers" | "cookies";

/** Schema map accumulated by `.params()`, `.query()`, `.json()`, and related builder methods. */
export type ProcedureInputContracts = Partial<Record<ProcedureInputTarget, StandardSchemaV1>>;

/** Context passed to route procedure validation error handlers. */
export interface ProcedureValidationErrorContext<
  TTarget extends ProcedureInputTarget = ProcedureInputTarget,
  TValue = unknown,
  TErrorCatalog extends RpcErrorCatalog = DefaultRpcErrorCatalog,
> {
  target: TTarget;
  value: TValue;
  issues: readonly StandardSchemaV1Issue[];
  request: NextRequest;
  response: ProcedureOnErrorResponse<TErrorCatalog>;
}

/** Values a route validation error handler may return to stop the request pipeline. */
export type ProcedureValidationErrorHandlerResult =
  | undefined
  | Response
  | NextResponse
  | ProcedureResult;

/** Handles a failed route procedure input validation. */
export type ProcedureValidationErrorHandler<
  TTarget extends ProcedureInputTarget = ProcedureInputTarget,
  TValue = unknown,
  TResult extends ProcedureValidationErrorHandlerResult = ProcedureValidationErrorHandlerResult,
  TErrorCatalog extends RpcErrorCatalog = DefaultRpcErrorCatalog,
> = (
  context: ProcedureValidationErrorContext<TTarget, TValue, TErrorCatalog>,
) => TResult | Promise<TResult>;

export type ProcedureValidationErrorRouteResponse = Exclude<
  ProcedureValidationErrorHandlerResult,
  undefined
>;

export type ProcedureValidationErrorResponseMap = Partial<
  Record<ProcedureInputTarget, ProcedureValidationErrorRouteResponse>
>;

type EmptyProcedureValidationErrorResponseMap = Record<never, never>;

/** Per-input options accepted by procedure input builder methods. */
export interface ProcedureInputOptions<
  TTarget extends ProcedureInputTarget = ProcedureInputTarget,
  TValue = unknown,
  TOnValidationErrorResult extends ProcedureValidationErrorHandlerResult =
    ProcedureValidationErrorHandlerResult,
  TErrorCatalog extends RpcErrorCatalog = DefaultRpcErrorCatalog,
> {
  onValidationError?: ProcedureValidationErrorHandler<
    TTarget,
    TValue,
    TOnValidationErrorResult,
    TErrorCatalog
  >;
}

export type ProcedureInputOptionMap = Partial<Record<ProcedureInputTarget, ProcedureInputOptions>>;

/** Internal contract stored on a procedure after input schemas are declared. */
export interface ProcedureInputContract<
  TValidationSchema extends ValidationSchema = ValidationSchema,
  TValidationErrorResponses extends ProcedureValidationErrorResponseMap =
    EmptyProcedureValidationErrorResponseMap,
> {
  contracts?: ProcedureInputContracts;
  options?: ProcedureInputOptionMap;
  validationErrorResponses?: TValidationErrorResponses;
  validationSchema?: TValidationSchema;
}

/** Internal contract stored on a procedure after `.output(...)` is declared. */
export interface ProcedureOutputContract<TRouteResponse = unknown> {
  schema?: unknown;
  response?: TRouteResponse;
  runtime?: boolean;
}

export declare const procedureRouteContractBrand: unique symbol;

/** Params shape emitted by generated `route-contract.ts` files. */
export type ProcedureRouteParams = Record<string, string | string[] | undefined>;

/** Generated sibling contract that binds a procedure to a concrete App Router path. */
export type ProcedureRouteContract<
  TPathname extends string = string,
  TParams extends ProcedureRouteParams = ProcedureRouteParams,
> = {
  readonly pathname: TPathname;
  readonly params: TParams;
  readonly [procedureRouteContractBrand]: {
    readonly pathname: TPathname;
    readonly params: TParams;
  };
};

export interface ProcedureRouteBinding<
  TPathname extends string = string,
  TParams extends ProcedureRouteParams = ProcedureRouteParams,
> {
  pathname: TPathname;
  params: TParams;
}

/** Internal type metadata attached to procedure-backed route and page values. */
export interface ProcedureDefinition<
  THttpMethod extends HttpMethod = HttpMethod,
  TValidationSchema extends ValidationSchema = ValidationSchema,
  TRouteResponse = unknown,
  TMeta extends RpcMeta = RpcMeta,
  TRoute extends ProcedureRouteBinding | undefined = ProcedureRouteBinding | undefined,
> {
  method?: THttpMethod;
  input?: ProcedureInputContract<TValidationSchema>;
  output?: ProcedureOutputContract<TRouteResponse>;
  meta?: TMeta;
  route?: TRoute;
}

export type EmptyProcedureDefinition = ProcedureDefinition<
  HttpMethod,
  ValidationSchema,
  unknown,
  RpcMeta,
  undefined
>;

export type MergeProcedureDefinition<
  TBase extends ProcedureDefinition,
  TExtra extends Partial<ProcedureDefinition>,
> = Omit<TBase, keyof TExtra> & TExtra;

/** Value branded with rpc4next procedure metadata for generator and client inference. */
export type WithProcedureDefinition<
  TValue,
  TDefinition extends Partial<ProcedureDefinition> = ProcedureDefinition,
> = TValue & {
  [procedureDefinitionSymbol]?: TDefinition;
};
