/*!
 * Portions of this code are based on the Hono project (https://github.com/honojs/middleware/tree/main/packages/zod-validator),
 * originally created by Yusuke Wada (https://github.com/yusukebe) and developed with
 * contributions from the Hono community.
 * This code has been adapted and modified for this project.
 * Original copyright belongs to Yusuke Wada and the Hono project contributors.
 * Hono is licensed under the MIT License.
 */

import { createHandler } from "../create-handler";
import { getCookiesObject, getHeadersObject } from "./validator-utils";
import type { ValidationSchema } from "../route-types";
import type {
  Params,
  Query,
  RouteContext,
  TypedNextResponse,
  ValidatedData,
  ValidationTarget,
} from "../types";

// I want to use currying so that the return value can be inferred.
export const validator = <
  TValidationTarget extends ValidationTarget,
  TParams extends Params,
  TQuery extends Query,
  TValidationSchema extends ValidationSchema,
>() => {
  return <TTypedNextResponse extends TypedNextResponse>(
    target: TValidationTarget,
    validateCallBack: (
      value: object,
      routeContext: RouteContext<TParams, TQuery, TValidationSchema>
    ) => Promise<ValidatedData | TTypedNextResponse>
  ) => {
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
        throw new Error(`Unexpected target: ${target satisfies never}`);
      })();

      const result = await validateCallBack(value, rc);

      if (result instanceof Response) {
        return result;
      }

      // If validation succeeds, register it as validatedData
      rc.req.addValidatedData(target, result);
    });
  };
};
