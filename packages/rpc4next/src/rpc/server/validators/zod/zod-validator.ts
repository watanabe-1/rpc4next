/*!
 * Portions of this code are based on the Hono project (https://github.com/honojs/middleware/tree/main/packages/zod-validator),
 * originally created by Yusuke Wada (https://github.com/yusukebe) and developed with
 * contributions from the Hono community.
 * This code has been adapted and modified for this project.
 * Original copyright belongs to Yusuke Wada and the Hono project contributors.
 * Hono is licensed under the MIT License.
 */

import type { HttpMethod } from "rpc4next-shared";
import type { ZodSchema, z } from "zod";
import { type RpcErrorEnvelope, rpcError } from "../../error";
import type { ValidationSchema } from "../../route-types";
import type {
  ConditionalValidationInput,
  Params,
  Query,
  RouteContext,
  TypedNextResponse,
  ValidatedData,
  ValidationTarget,
} from "../../types";
import { validator } from "../validator";

export const zValidator = <
  THttpMethod extends HttpMethod,
  TValidationTarget extends ValidationTarget<THttpMethod>,
  // biome-ignore lint/suspicious/noExplicitAny: intentional for existing type patterns
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
  THookReturn extends TypedNextResponse | undefined =
    | TypedNextResponse<
        RpcErrorEnvelope<"BAD_REQUEST", z.ZodError<TInput>>,
        400,
        "application/json"
      >
    | undefined,
>(
  target: TValidationTarget,
  schema: TSchema,
  hook?: (
    result: z.ZodSafeParseResult<TOutput>,
    routeContext: RouteContext<TParams, TQuery, TValidationSchema>,
  ) => THookReturn,
) => {
  const resolvedHook =
    hook ??
    ((result, rc) => {
      if (!result.success) {
        return rc.json(
          rpcError("BAD_REQUEST", {
            message: result.error.message,
            details: result.error,
          }).toJSON(),
          { status: 400 },
        );
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
        "If you provide a custom hook, you must explicitly return a response when validation fails.",
      );
    }

    return result.data as ValidatedData;
  });
};
