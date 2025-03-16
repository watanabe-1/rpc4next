import { ZodSchema, z } from "zod";
import { ValidationTarget, Validated } from "../../types";

export type ZodValidater<
  TTarget extends ValidationTarget,
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  TSchema extends ZodSchema<any>,
> = Validated<TTarget, z.input<TSchema>, z.output<TSchema>>;

export type ZodValidaters<TValidators extends ZodValidatorArgs> = {
  [TIndex in keyof TValidators]: ZodValidater<
    TValidators[TIndex]["target"],
    TValidators[TIndex]["schema"]
  >;
};

export type ZodValidatorArgs = {
  target: ValidationTarget;
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  schema: ZodSchema<any>;
}[];

export type ExtractZodValidaters<
  TZodValidaters extends ZodValidaters<ZodValidatorArgs>,
  TTarget extends ValidationTarget,
> = {
  [TIndex in keyof TZodValidaters]: TZodValidaters[TIndex]["key"] extends TTarget
    ? TZodValidaters[TIndex]
    : never;
}[number];
