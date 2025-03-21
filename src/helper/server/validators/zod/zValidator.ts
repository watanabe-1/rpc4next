import { z, ZodSchema } from "zod";
import { createHandler } from "../../createHandler";
import type {
  Context,
  Params,
  Query,
  RouteResponse,
  Validated,
  ValidatedOutputToString,
  ValidationTarget,
} from "../../types";

export const zValidator = <
  TValidationTarget extends ValidationTarget,
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  TSchema extends ZodSchema<any>,
  TInput = z.input<TSchema>,
  TOutput = z.output<TSchema>,
  TValidated extends Validated = {
    input: Record<TValidationTarget, TInput>;
    output: Record<TValidationTarget, TOutput>;
  },
>(
  target: TValidationTarget,
  schema: TSchema,
  hook?: (
    result: z.SafeParseReturnType<TInput, TOutput>,
    context: Context
  ) => RouteResponse
) => {
  return createHandler<
    TValidationTarget extends "params"
      ? ValidatedOutputToString<TValidationTarget, TValidated>
      : Params,
    TValidationTarget extends "query"
      ? ValidatedOutputToString<TValidationTarget, TValidated>
      : Query,
    TValidated
  >()(async (c) => {
    const value = await (async () => {
      if (target === "params") {
        return await c.req.params();
      }
      if (target === "query") {
        return c.req.query();
      }
    })();

    const result = await schema.safeParseAsync(value);

    if (hook) {
      const hookResult = await hook(result, c as never);
      if (hookResult instanceof Response) {
        return hookResult as never;
      }
    }

    if (!result.success) {
      // Validation failed
      return c.json(result, { status: 400 });
    }

    // If validation succeeds, register it as validatedData
    c.req.addValidatedData(target, result.data);

    // Return `undefined` if all validations pass
    return undefined as never;
  });
};
