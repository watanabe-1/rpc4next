import type { NextRequest, NextResponse } from "next/server";
import type { HttpMethod } from "rpc4next-shared";

import type { RpcMeta } from "./meta";
import type { ProcedureOnErrorResponse } from "./on-error";
import type { ProcedureResult } from "./procedure";
import type { ValidationSchema } from "./route-types";
import type { StandardSchemaV1, StandardSchemaV1Issue } from "./standard-schema";

export type ProcedureInputTarget = "params" | "query" | "json" | "formData" | "headers" | "cookies";

export type ProcedureInputContracts = Partial<Record<ProcedureInputTarget, StandardSchemaV1>>;

export interface ProcedureValidationErrorContext<
  TTarget extends ProcedureInputTarget = ProcedureInputTarget,
  TValue = unknown,
> {
  target: TTarget;
  value: TValue;
  issues: readonly StandardSchemaV1Issue[];
  request: NextRequest;
  response: ProcedureOnErrorResponse;
}

export type ProcedureValidationErrorHandlerResult =
  | undefined
  | Response
  | NextResponse
  | ProcedureResult;

export type ProcedureValidationErrorRouteResponse = Exclude<
  ProcedureValidationErrorHandlerResult,
  undefined
>;

export type ProcedureValidationErrorResponseMap = Partial<
  Record<ProcedureInputTarget, ProcedureValidationErrorRouteResponse>
>;

type EmptyProcedureValidationErrorResponseMap = Record<never, never>;

export interface ProcedureInputOptions<
  TTarget extends ProcedureInputTarget = ProcedureInputTarget,
  TValue = unknown,
  TOnValidationErrorResult extends ProcedureValidationErrorHandlerResult =
    ProcedureValidationErrorHandlerResult,
> {
  onValidationError?: (
    context: ProcedureValidationErrorContext<TTarget, TValue>,
  ) => TOnValidationErrorResult | Promise<TOnValidationErrorResult>;
}

export type ProcedureInputOptionMap = Partial<Record<ProcedureInputTarget, ProcedureInputOptions>>;

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

export interface ProcedureOutputContract<TRouteResponse = unknown> {
  schema?: unknown;
  response?: TRouteResponse;
  runtime?: boolean;
}

export declare const procedureRouteContractBrand: unique symbol;

export type ProcedureRouteParams = Record<string, string | string[] | undefined>;

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

export const procedureDefinitionSymbol = Symbol.for("rpc4next.procedure.definition");

export type WithProcedureDefinition<
  TValue,
  TDefinition extends Partial<ProcedureDefinition> = ProcedureDefinition,
> = TValue & {
  [procedureDefinitionSymbol]?: TDefinition;
};

export const attachProcedureDefinition = <
  TValue extends object,
  TDefinition extends Partial<ProcedureDefinition>,
>(
  value: TValue,
  definition: TDefinition,
): WithProcedureDefinition<TValue, TDefinition> => {
  Object.defineProperty(value, procedureDefinitionSymbol, {
    configurable: true,
    enumerable: false,
    value: definition,
    writable: true,
  });

  return value as WithProcedureDefinition<TValue, TDefinition>;
};

export const getProcedureDefinition = <
  TDefinition extends Partial<ProcedureDefinition> = ProcedureDefinition,
>(
  value: unknown,
): TDefinition | undefined => {
  if (typeof value !== "function" && typeof value !== "object") {
    return undefined;
  }

  return (value as WithProcedureDefinition<Record<PropertyKey, unknown>, TDefinition>)[
    procedureDefinitionSymbol
  ];
};
