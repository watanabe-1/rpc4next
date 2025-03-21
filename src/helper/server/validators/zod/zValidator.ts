import { z, ZodSchema } from "zod";
import { createHandler } from "../../createHandler";
import type {
  Context,
  Params,
  Query,
  TypedNextResponse,
  Validated,
  ValidatedOutputToString,
  ValidationTarget,
} from "../../types";

export const zValidator = <
  TValidationTarget extends ValidationTarget,
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  TSchema extends ZodSchema<any>,
  Tparams extends TValidationTarget extends "params"
    ? ValidatedOutputToString<TValidationTarget, TValidated>
    : Params,
  TQuery extends TValidationTarget extends "query"
    ? ValidatedOutputToString<TValidationTarget, TValidated>
    : Query,
  TInput = z.input<TSchema>,
  TOutput = z.output<TSchema>,
  TValidated extends Validated = {
    input: Record<TValidationTarget, TInput>;
    output: Record<TValidationTarget, TOutput>;
  },
  THookReturn extends TypedNextResponse | void = void,
>(
  target: TValidationTarget,
  schema: TSchema,
  hook?: (
    result: z.SafeParseReturnType<TInput, TOutput>,
    context: Context<Tparams, TQuery, TValidated>
  ) => THookReturn
) => {
  return createHandler<Tparams, TQuery, TValidated>()(async (c) => {
    const value = await (async () => {
      if (target === "params") {
        return await c.req.params();
      }
      if (target === "query") {
        return c.req.query();
      }
    })();

    const result: z.SafeParseReturnType<TInput, TOutput> =
      await schema.safeParseAsync(value);

    if (hook) {
      const hookResult = hook(result, c);
      if (hookResult instanceof Response) {
        // If it's of type Response, it won't be void, so we're excluding void here
        return hookResult as Exclude<THookReturn, void>;
      }
    }

    if (!result.success) {
      // Validation failed
      return c.json(result, { status: 400 });
    }

    // If validation succeeds, register it as validatedData
    c.req.addValidatedData(target, result.data as object);

    // Return `undefined` if all validations pass
    return undefined as never;
  });
};
