import type {
  ProcedureDefinition,
  WithProcedureDefinition,
} from "./procedure-types";
import { getProcedureDefinition } from "./procedure-types";

export interface RpcMetaBase {
  summary?: string;
  tags?: string[];
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

export const getRouteMeta = <TValue>(value: TValue): InferRouteMeta<TValue> => {
  return getProcedureDefinition(value)?.meta as InferRouteMeta<TValue>;
};
