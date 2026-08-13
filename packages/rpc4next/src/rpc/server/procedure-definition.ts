import type { ProcedureDefinition, WithProcedureDefinition } from "./procedure-types";

export const procedureDefinitionSymbol = Symbol.for("rpc4next.procedure.definition");

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
