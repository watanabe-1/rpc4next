import type { NextRequest, NextResponse } from "next/server";
import type { HttpMethod } from "rpc4next-shared";
import type { RpcErrorCode, RpcErrorEnvelope } from "./error";
import type { ProcedureErrorFormatterRouteContext } from "./error-formatter";
import type { RpcMeta } from "./meta";
import type { ProcedureResult } from "./procedure";
import type { ValidationSchema } from "./route-types";
import type {
  StandardSchemaV1,
  StandardSchemaV1Issue,
} from "./standard-schema";

export type ProcedureInputTarget =
  | "params"
  | "query"
  | "json"
  | "formData"
  | "headers"
  | "cookies";

export type ProcedureInputContracts = Partial<
  Record<ProcedureInputTarget, StandardSchemaV1>
>;

export interface ProcedureValidationErrorContext<
  TTarget extends ProcedureInputTarget = ProcedureInputTarget,
  TValue = unknown,
> {
  target: TTarget;
  value: TValue;
  issues: readonly StandardSchemaV1Issue[];
  request: NextRequest;
  routeContext: ProcedureErrorFormatterRouteContext;
}

export type ProcedureValidationErrorHandlerResult =
  | undefined
  | Response
  | NextResponse
  | ProcedureResult;

export interface ProcedureInputOptions<
  TTarget extends ProcedureInputTarget = ProcedureInputTarget,
  TValue = unknown,
> {
  onValidationError?: (
    context: ProcedureValidationErrorContext<TTarget, TValue>,
  ) =>
    | ProcedureValidationErrorHandlerResult
    | Promise<ProcedureValidationErrorHandlerResult>;
}

export type ProcedureInputOptionMap = Partial<
  Record<ProcedureInputTarget, ProcedureInputOptions>
>;

export interface ProcedureInputContract<
  TValidationSchema extends ValidationSchema = ValidationSchema,
> {
  contracts?: ProcedureInputContracts;
  options?: ProcedureInputOptionMap;
  validationSchema?: TValidationSchema;
}

export interface ProcedureOutputContract<TRouteResponse = unknown> {
  schema?: unknown;
  response?: TRouteResponse;
  runtime?: boolean;
}

export interface ProcedureErrorContract<
  TCode extends RpcErrorCode = RpcErrorCode,
  TDetails = unknown,
> {
  code?: TCode;
  envelope?: RpcErrorEnvelope<TCode, TDetails>;
  variants?: readonly ProcedureErrorContract[];
}

export declare const procedureRouteContractBrand: unique symbol;

export type ProcedureRouteParams = Record<
  string,
  string | string[] | undefined
>;

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
  TError extends ProcedureErrorContract = ProcedureErrorContract,
  TRoute extends ProcedureRouteBinding | undefined =
    | ProcedureRouteBinding
    | undefined,
> {
  method?: THttpMethod;
  input?: ProcedureInputContract<TValidationSchema>;
  output?: ProcedureOutputContract<TRouteResponse>;
  error?: TError;
  meta?: TMeta;
  route?: TRoute;
}

export type EmptyProcedureDefinition = ProcedureDefinition<
  HttpMethod,
  ValidationSchema,
  unknown,
  RpcMeta,
  never,
  undefined
>;

export type MergeProcedureDefinition<
  TBase extends ProcedureDefinition,
  TExtra extends Partial<ProcedureDefinition>,
> = Omit<TBase, keyof TExtra> & TExtra;

type ExtractProcedureErrorDefinition<TDefinition extends ProcedureDefinition> =
  TDefinition extends {
    error?: infer TError;
  }
    ? Exclude<TError, undefined>
    : never;

export type AppendProcedureErrorDefinition<
  TDefinition extends ProcedureDefinition,
  TError extends ProcedureErrorContract,
> = MergeProcedureDefinition<
  TDefinition,
  {
    error: ExtractProcedureErrorDefinition<TDefinition> | TError;
  }
>;

export const procedureDefinitionSymbol = Symbol.for(
  "rpc4next.procedure.definition",
);

export type WithProcedureDefinition<
  TValue,
  TDefinition extends ProcedureDefinition = ProcedureDefinition,
> = TValue & {
  [procedureDefinitionSymbol]?: TDefinition;
};

export const attachProcedureDefinition = <
  TValue extends object,
  TDefinition extends ProcedureDefinition,
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
  TDefinition extends ProcedureDefinition = ProcedureDefinition,
>(
  value: unknown,
): TDefinition | undefined => {
  if (typeof value !== "function" && typeof value !== "object") {
    return undefined;
  }

  return (
    value as WithProcedureDefinition<Record<PropertyKey, unknown>, TDefinition>
  )[procedureDefinitionSymbol];
};
