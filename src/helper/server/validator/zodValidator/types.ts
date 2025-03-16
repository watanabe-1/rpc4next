import { ZodSchema, z } from "zod";
import { ValidationTarget, Validated } from "../../types";

export type ZodValidater<
  TTarget extends ValidationTarget,
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  TSchema extends ZodSchema<any>,
> = Validated<TTarget, z.infer<TSchema>>;

export type ZodValidaters<TValidators extends ZodValidatorArgs> = {
  [K in keyof TValidators]: ZodValidater<
    TValidators[K]["target"],
    TValidators[K]["schema"]
  >;
};

export type ZodValidatorArgs = {
  target: ValidationTarget;
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  schema: ZodSchema<any>;
}[];
