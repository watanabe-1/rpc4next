import { attachProcedureDefinition, getProcedureDefinition } from "./procedure-types";
import type {
  MergeProcedureDefinition,
  ProcedureDefinition,
  ProcedureOutputContract,
  WithProcedureDefinition,
} from "./procedure-types";
import type { InferSchemaOutput } from "./schema-inference";

declare const __outputContract: unique symbol;

export type OutputContract<TSchema = unknown, TOutput = unknown> = {
  readonly schema: TSchema;
  readonly [__outputContract]?: {
    output: TOutput;
  };
};

type ExtractProcedureDefinition<TValue> =
  TValue extends WithProcedureDefinition<unknown, infer TDefinition>
    ? TDefinition
    : ProcedureDefinition;

type ReplaceProcedureOutput<
  TValue,
  TOutput,
  TDefinition extends ProcedureDefinition = ExtractProcedureDefinition<TValue>,
> = WithProcedureDefinition<
  TValue,
  MergeProcedureDefinition<
    TDefinition,
    {
      output: ProcedureOutputContract<TOutput>;
    }
  >
>;

export const output = <TSchema, TOutput = InferSchemaOutput<TSchema>>(
  schema: TSchema,
): OutputContract<TSchema, TOutput> => {
  return { schema } as OutputContract<TSchema, TOutput>;
};

export const withOutput = <
  TSchema,
  TOutput = InferSchemaOutput<TSchema>,
  TValue extends object = object,
>(
  contract: OutputContract<TSchema, TOutput>,
  value: TValue,
): ReplaceProcedureOutput<TValue, TOutput> => {
  const definition = getProcedureDefinition(value);

  return attachProcedureDefinition(value, {
    ...definition,
    output: {
      schema: contract.schema,
    },
  }) as ReplaceProcedureOutput<TValue, TOutput>;
};
