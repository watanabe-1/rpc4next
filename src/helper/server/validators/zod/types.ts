import type {
  ValidationTarget,
  Validated,
  Context,
  RouteResponse,
} from "../../types";
import type { ZodSchema, z } from "zod";

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

// eslint-disable-next-line @typescript-eslint/no-explicit-any
type ZodValidatorArg<TSchema extends ZodSchema<any> = ZodSchema<any>> = {
  target: ValidationTarget;
  schema: TSchema;
  hook?: (
    result: z.SafeParseReturnType<z.input<TSchema>, z.output<TSchema>>,
    context: Context
  ) => RouteResponse;
};

export type ZodValidatorArgs = ZodValidatorArg[];

export type ExtractZodValidaters<
  TZodValidaters extends ZodValidaters<ZodValidatorArgs>,
  TTarget extends ValidationTarget,
> = {
  [TIndex in keyof TZodValidaters]: TZodValidaters[TIndex]["key"] extends TTarget
    ? TZodValidaters[TIndex]
    : never;
}[number];
