import { ExtractZodValidaters, ZodValidaters, ZodValidatorArgs } from "./types";
import { Context, IsNever, ObjectPropertiesToString } from "../../types";

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
        ? unknown
        : ObjectPropertiesToString<TParams>,
      IsNever<TQuery> extends true ? unknown : ObjectPropertiesToString<TQuery>,
      TZodValidaters
    >
  ) => {
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
