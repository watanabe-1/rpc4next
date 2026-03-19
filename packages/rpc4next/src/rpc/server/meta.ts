import type {
  MergeProcedureDefinition,
  ProcedureDefinition,
  WithProcedureDefinition,
} from "./procedure-types";
import {
  attachProcedureDefinition,
  getProcedureDefinition,
} from "./procedure-types";

export interface RpcMetaBase {
  summary?: string;
  tags?: string[];
  auth?: "required" | "optional" | "none";
  cache?: "default" | "no-store" | "force-cache";
  idempotent?: boolean;
  deprecated?: boolean;
}

export type RpcMeta<TExtra extends object = Record<never, never>> =
  RpcMetaBase & TExtra;

type ExtractProcedureDefinition<TValue> =
  TValue extends WithProcedureDefinition<unknown, infer TDefinition>
    ? TDefinition
    : ProcedureDefinition;

export type InferRouteMeta<TValue> =
  ExtractProcedureDefinition<TValue> extends ProcedureDefinition<
    infer _THttpMethod,
    infer _TValidationSchema,
    infer _TRouteResponse,
    infer TMeta
  >
    ? TMeta
    : never;

type ReplaceProcedureMeta<
  TValue,
  TMeta extends RpcMeta,
  TDefinition extends ProcedureDefinition = ExtractProcedureDefinition<TValue>,
> = WithProcedureDefinition<
  TValue,
  MergeProcedureDefinition<TDefinition, { meta: TMeta }>
>;

export const withMeta = <TMeta extends RpcMeta, TValue extends object = object>(
  meta: TMeta,
  value: TValue,
): ReplaceProcedureMeta<TValue, TMeta> => {
  const definition = getProcedureDefinition(value);

  return attachProcedureDefinition(value, {
    ...definition,
    meta,
  }) as ReplaceProcedureMeta<TValue, TMeta>;
};

export const getRouteMeta = <TValue>(value: TValue): InferRouteMeta<TValue> => {
  return getProcedureDefinition(value)?.meta as InferRouteMeta<TValue>;
};
