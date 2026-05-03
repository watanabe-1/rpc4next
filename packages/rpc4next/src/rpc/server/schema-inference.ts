import type { StandardSchemaV1 } from "./standard-schema";

type StandardSchemaTypes<TSchema> = TSchema extends {
  readonly "~standard": { readonly types?: infer TTypes };
}
  ? NonNullable<TTypes>
  : never;

export type InferSchemaInput<TSchema> = [StandardSchemaTypes<TSchema>] extends [never]
  ? TSchema extends { _input?: infer TInput }
    ? TInput
    : TSchema extends { _zod: { input: infer TInput } }
      ? TInput
      : TSchema extends { inferIn: infer TInput }
        ? TInput
        : TSchema extends { input: infer TInput }
          ? TInput
          : unknown
  : StandardSchemaTypes<TSchema> extends { readonly input: infer TInput }
    ? TInput
    : unknown;

export type InferSchemaOutput<TSchema> = [StandardSchemaTypes<TSchema>] extends [never]
  ? TSchema extends { _output?: infer TOutput }
    ? TOutput
    : TSchema extends { _zod: { output: infer TOutput } }
      ? TOutput
      : TSchema extends { inferOut: infer TOutput }
        ? TOutput
        : TSchema extends { _type: infer TOutput }
          ? TOutput
          : TSchema extends { output: infer TOutput }
            ? TOutput
            : unknown
  : StandardSchemaTypes<TSchema> extends { readonly output: infer TOutput }
    ? TOutput
    : unknown;

export type OutputSchema<TOutput = unknown> =
  | StandardSchemaV1<unknown, TOutput>
  | { _output: TOutput }
  | { _type: TOutput }
  | { output: TOutput };
