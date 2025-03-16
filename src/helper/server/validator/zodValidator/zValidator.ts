import { ZodValidaters, ZodValidatorArgs } from "./types";
import { Context } from "../../types";

export const zValidator = <TValidators extends ZodValidatorArgs>(
  ...validators: TValidators
) => {
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  return async (c: Context<any, any, ZodValidaters<TValidators>>) => {
    for (const { target, schema } of validators) {
      // 入力値を取り出す
      const value = await (async () => {
        if (target === "params") {
          return await c.req.params();
        }
        if (target === "query") {
          return c.req.query();
        }
      })();

      const result = await schema.safeParseAsync(value);

      if (!result.success) {
        // バリデーション失敗
        return c.json(result, { status: 400 }) as never;
      }

      // バリデーション成功時は validatedData として登録
      c.req.addValidatedData(target, result.data);
    }

    // すべてのバリデーションを通過したら `undefined` を返す
    return undefined as never;
  };
};
