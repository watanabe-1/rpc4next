/*!
 * Portions of this code are based on the Hono project (https://github.com/honojs/middleware/tree/main/packages/zod-validator),
 * originally created by Yusuke Wada (https://github.com/yusukebe) and developed with
 * contributions from the Hono community.
 * This code has been adapted and modified for this project.
 * Original copyright belongs to Yusuke Wada and the Hono project contributors.
 * Hono is licensed under the MIT License.
 */

import { validator } from "../validator";
import type { HttpMethod } from "../../../lib/types";
import type { ValidationSchema } from "../../route-types";
import type {
  RouteContext,
  Params,
  Query,
  TypedNextResponse,
  ConditionalValidationInput,
  ValidationTarget,
  ValidatedData,
} from "../../types";
import type { z, ZodSchema } from "zod";

export const zValidator = <
  THttpMethod extends HttpMethod,
  TValidationTarget extends ValidationTarget<THttpMethod>,
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  TSchema extends ZodSchema<any>,
  TParams extends ConditionalValidationInput<
    TValidationTarget,
    "params",
    TValidationSchema,
    Params
  > &
    Params,
  TQuery extends ConditionalValidationInput<
    TValidationTarget,
    "query",
    TValidationSchema,
    Query
  > &
    Query,
  TInput = z.input<TSchema>,
  TOutput = z.output<TSchema>,
  TValidationSchema extends ValidationSchema = {
    input: Record<TValidationTarget, TInput>;
    output: Record<TValidationTarget, TOutput>;
  },
  THookReturn extends TypedNextResponse | void = TypedNextResponse<
    z.ZodSafeParseError<TInput>,
    400,
    "application/json"
  > | void,
>(
  target: TValidationTarget,
  schema: TSchema,
  hook?: (
    result: z.ZodSafeParseResult<TOutput>,
    routeContext: RouteContext<TParams, TQuery, TValidationSchema>
  ) => THookReturn
) => {
  const resolvedHook =
    hook ??
    ((result, rc) => {
      if (!result.success) {
        return rc.json(result, { status: 400 });
      }
    });

  return validator<
    THttpMethod,
    TValidationTarget,
    TParams,
    TQuery,
    TValidationSchema
  >()(target, async (value, rc) => {
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

    return result.data as ValidatedData;
  });
};
