import type { HttpMethod } from "rpc4next-shared";
import type { RpcErrorCode, RpcErrorEnvelope } from "./error";
import type { RpcMeta } from "./meta";
import type { ValidationSchema } from "./route-types";
import type { StandardSchemaV1 } from "./standard-schema";

export type ProcedureInputTarget =
  | "params"
  | "query"
  | "json"
  | "headers"
  | "cookies";

export type ProcedureInputContracts = Partial<
  Record<ProcedureInputTarget, StandardSchemaV1>
>;

export interface ProcedureInputContract<
  TValidationSchema extends ValidationSchema = ValidationSchema,
> {
  contracts?: ProcedureInputContracts;
  validationSchema?: TValidationSchema;
}

export interface ProcedureOutputContract<TRouteResponse = unknown> {
  schema?: unknown;
  response?: TRouteResponse;
}

export interface ProcedureErrorContract<
  TCode extends RpcErrorCode = RpcErrorCode,
  TDetails = unknown,
> {
  code?: TCode;
  envelope?: RpcErrorEnvelope<TCode, TDetails>;
}

export interface ProcedureDefinition<
  THttpMethod extends HttpMethod = HttpMethod,
  TValidationSchema extends ValidationSchema = ValidationSchema,
  TRouteResponse = unknown,
  TMeta extends RpcMeta = RpcMeta,
  TErrorCode extends RpcErrorCode = RpcErrorCode,
  TErrorDetails = unknown,
> {
  method?: THttpMethod;
  input?: ProcedureInputContract<TValidationSchema>;
  output?: ProcedureOutputContract<TRouteResponse>;
  error?: ProcedureErrorContract<TErrorCode, TErrorDetails>;
  meta?: TMeta;
}

export type MergeProcedureDefinition<
  TBase extends ProcedureDefinition,
  TExtra extends Partial<ProcedureDefinition>,
> = Omit<TBase, keyof TExtra> & TExtra;

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
