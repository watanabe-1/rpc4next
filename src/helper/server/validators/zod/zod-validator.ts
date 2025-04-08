/*!
 * Portions of this code are based on the Hono project (https://github.com/honojs/middleware/tree/main/packages/zod-validator),
 * originally created by Yusuke Wada (https://github.com/yusukebe) and developed with
 * contributions from the Hono community.
 * This code has been adapted and modified for this project.
 * Original copyright belongs to Yusuke Wada and the Hono project contributors.
 * Hono is licensed under the MIT License.
 */

import { createHandler } from "../../create-handler";
import { getCookiesObject, getHeadersObject } from "../validator-utils";
import type { ValidationSchema } from "../../route-types";
import type {
  RouteContext,
  Params,
  Query,
  TypedNextResponse,
  ConditionalValidationInput,
  ValidationTarget,
} from "../../types";
import type { z, ZodSchema } from "zod";

export const zodValidator = <
  TValidationTarget extends ValidationTarget,
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
    z.SafeParseError<TInput>,
    400,
    "application/json"
  > | void,
>(
  target: TValidationTarget,
  schema: TSchema,
  hook?: (
    result: z.SafeParseReturnType<TInput, TOutput>,
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

  return createHandler<TParams, TQuery, TValidationSchema>()(async (rc) => {
    const value = await (async () => {
      if (target === "params") {
        return await rc.req.params();
      }
      if (target === "query") {
        return rc.req.query();
      }
      if (target === "json") {
        return rc.req.json();
      }
      if (target === "headers") {
        return await getHeadersObject();
      }
      if (target === "cookies") {
        return await getCookiesObject();
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
  });
};
