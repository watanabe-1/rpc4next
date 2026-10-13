import { getProcedureDefinition } from "./procedure-definition";
import type { ProcedureDefinition, WithProcedureDefinition } from "./procedure-types";

/** Lightweight metadata that can be attached to a procedure with `.meta(...)`. */
export interface RpcMetaBase {
  summary?: string;
  tags?: string[];
  deprecated?: boolean;
}

/** Procedure metadata shape with optional app-specific fields. */
export type RpcMeta<TExtra extends object = Record<never, never>> = RpcMetaBase & TExtra;

type ExtractProcedureDefinition<TValue> =
  TValue extends WithProcedureDefinition<unknown, infer TDefinition>
    ? TDefinition
    : ProcedureDefinition;

/** Infers metadata attached to a procedure-backed route or page value. */
export type InferRouteMeta<TValue> =
  ExtractProcedureDefinition<TValue> extends ProcedureDefinition<
    infer _THttpMethod,
    infer _TValidationSchema,
    infer _TRouteResponse,
    infer TMeta
  >
    ? TMeta
    : never;

/** Reads metadata attached by `.meta(...)` from a generated procedure value. */
export const getRouteMeta = <TValue>(value: TValue): InferRouteMeta<TValue> => {
  return getProcedureDefinition(value)?.meta as InferRouteMeta<TValue>;
};
