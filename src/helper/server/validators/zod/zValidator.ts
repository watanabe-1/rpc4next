import { ExtractZodValidaters, ZodValidaters, ZodValidatorArgs } from "./types";
import {
  Context,
  IsNever,
  ObjectPropertiesToString,
  Params,
  Query,
} from "../../types";

export const zValidator = <
  TValidators extends ZodValidatorArgs,
  TZodValidaters extends ZodValidaters<TValidators>,
  TParams extends ExtractZodValidaters<TZodValidaters, "params">["input"],
  TQuery extends ExtractZodValidaters<TZodValidaters, "query">["input"],
>(
  ...validators: TValidators
) => {
  return async (
    c: Context<
      IsNever<TParams> extends true
        ? Params
        : ObjectPropertiesToString<TParams>,
      IsNever<TQuery> extends true ? Query : ObjectPropertiesToString<TQuery>,
      TZodValidaters
    >
  ) => {
    for (const { target, schema, hook } of validators) {
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
        const hookResult = await hook(result, c);
        if (hookResult instanceof Response) {
          return hookResult as never;
        }
      }

      if (!result.success) {
        // Validation failed
        return c.json(result, { status: 400 }) as never;
      }

      // If validation succeeds, register it as validatedData
      c.req.addValidatedData(target, result.data);
    }

    // Return `undefined` if all validations pass
    return undefined as never;
  };
};
