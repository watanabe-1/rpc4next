import { ZodSchema, z } from "zod";
import { ValidationTarget, ZodValidate, Context } from "../../types";

export const zValidator = <
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  TValidators extends { target: ValidationTarget; schema: ZodSchema<any> }[],
>(
  ...validators: TValidators
) => {
  return async (
    c: Context<
      TValidators[number]["target"] extends "params"
        ? z.infer<TValidators[number]["schema"]>
        : unknown,
      TValidators[number]["target"] extends "query"
        ? z.infer<TValidators[number]["schema"]>
        : unknown,
      ZodValidate<
        TValidators[number]["target"],
        TValidators[number]["schema"]
      >[]
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
