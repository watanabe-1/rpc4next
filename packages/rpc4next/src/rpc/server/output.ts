import { attachProcedureDefinition, getProcedureDefinition } from "./procedure-definition";
import type {
  MergeProcedureDefinition,
  ProcedureDefinition,
  ProcedureOutputContract,
  WithProcedureDefinition,
} from "./procedure-types";
import type { InferSchemaOutput } from "./schema-inference";

declare const __outputContract: unique symbol;

/** Reusable output contract created by `output(schema)`. */
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

/**
 * Creates a reusable output contract for procedure response typing.
 *
 * Pass the result to `withOutput(...)`, or use `procedure.output(schema)` when declaring the
 * contract inline on a builder.
 */
export const output = <TSchema, TOutput = InferSchemaOutput<TSchema>>(
  schema: TSchema,
): OutputContract<TSchema, TOutput> => {
  return { schema } as OutputContract<TSchema, TOutput>;
};

/**
 * Attaches an output contract to an existing route handler or procedure value.
 *
 * This is useful when you keep a native Next.js handler but still want the generated client to
 * infer a more precise success payload.
 */
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
