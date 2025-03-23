import { createHandler } from "../../create-handler";
import type {
  RouteContext,
  Params,
  Query,
  TypedNextResponse,
  ValidationSchema,
  ConditionalValidationInput,
  ValidationTarget,
} from "../../types";
import type { z, ZodSchema } from "zod";

export const zodValidator = <
  TValidationTarget extends ValidationTarget,
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  TSchema extends ZodSchema<any>,
  Tparams extends ConditionalValidationInput<
    TValidationTarget,
    "params",
    TValidationSchema,
    Params
  >,
  TQuery extends ConditionalValidationInput<
    TValidationTarget,
    "query",
    TValidationSchema,
    Query
  >,
  TInput = z.input<TSchema>,
  TOutput = z.output<TSchema>,
  TValidationSchema extends ValidationSchema = {
    input: Record<TValidationTarget, TInput>;
    output: Record<TValidationTarget, TOutput>;
  },
  THookReturn extends TypedNextResponse | void = TypedNextResponse<
    z.SafeParseError<TInput>,
    400,
    "application/json"
  > | void,
>(
  target: TValidationTarget,
  schema: TSchema,
  hook?: (
    result: z.SafeParseReturnType<TInput, TOutput>,
    routeContext: RouteContext<Tparams, TQuery, TValidationSchema>
  ) => THookReturn
) => {
  const resolvedHook =
    hook ??
    ((result, rc) => {
      if (!result.success) {
        return rc.json(result, { status: 400 });
      }
    });

  return createHandler<Tparams, TQuery, TValidationSchema>()(async (rc) => {
    const value = await (async () => {
      if (target === "params") {
        return await rc.req.params();
      }
      if (target === "query") {
        return rc.req.query();
      }
    })();

    const result = await schema.safeParseAsync(value);

    const hookResult = resolvedHook(result, rc);
    if (hookResult instanceof Response) {
      // If it's of type Response, it won't be void, so we're excluding void here
      return hookResult as Exclude<THookReturn, void>;
    }

    if (!result.success) {
      throw new Error(
        "If you provide a custom hook, you must explicitly return a response when validation fails."
      );
    }

    // If validation succeeds, register it as validatedData
    rc.req.addValidatedData(target, result.data);

    // Return `undefined` if all validations pass
    return undefined as never;
  });
};
