/* eslint-disable @typescript-eslint/no-explicit-any */
import { notFound } from "next/navigation";
import { NextRequest, NextResponse } from "next/server";
import { ZodSchema, z } from "zod";
import { createQueryParamsProxy } from "./createQueryParamsProxy";
import type {
  Query,
  TypedNextResponse,
  HttpStatusCode,
  ContentType,
  Context,
  Params,
  ValidationTarget,
  RouteResponseType,
  Bindings,
  Validated,
  RouteHandler,
  ZodValidate,
} from "./types";
import type { HTTP_METHOD } from "next/dist/server/web/http";

export const zValidator = <
  TValidators extends { target: ValidationTarget; schema: ZodSchema<any> }[],
>(
  ...validators: TValidators
) => {
  return async (
    c: Context<
      TValidators[number]["target"] extends "params"
        ? z.input<TValidators[number]["schema"]>
        : any,
      TValidators[number]["target"] extends "query"
        ? z.input<TValidators[number]["schema"]>
        : any,
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

const createHandler = <
  TParams extends Params,
  TQuery extends Query,
  TValidateds extends Validated[], // ★ ここを変更
  THandler extends (context: Context<TParams, TQuery, TValidateds>) => unknown,
>(
  handlers: THandler[]
) => {
  type HandlerReturn = ReturnType<THandler>;
  type ResolvedHandlerResult =
    HandlerReturn extends Promise<TypedNextResponse>
      ? Awaited<HandlerReturn>
      : HandlerReturn;

  return async (
    req: NextRequest,
    segmentData: { params: Promise<TParams> }
  ) => {
    // バリデーション結果を保持しておくためのオブジェクト
    const validationResults = {} as Record<ValidationTarget, unknown>;

    const context: Context<TParams, TQuery, TValidateds> = {
      req: Object.assign(req, {
        query: () => createQueryParamsProxy<TQuery>(req.nextUrl.searchParams),
        params: async () => await segmentData.params,
        valid: (target: ValidationTarget) => {
          // バリデーション結果を取り出す
          return validationResults[target] as any;
        },
        addValidatedData: (
          target: ValidationTarget,
          value: Record<string, any>
        ) => {
          validationResults[target] = value;
        },
      }),
      res: new NextResponse(),
      body: <
        TData extends BodyInit | null,
        TStatus extends HttpStatusCode,
        TContentType extends ContentType,
      >(
        data: TData,
        init?: ResponseInit & { status?: TStatus; contentType?: TContentType }
      ) =>
        new NextResponse<TData>(data, init) as TypedNextResponse<
          TData,
          TStatus,
          TContentType
        >,

      json: <TData, TStatus extends HttpStatusCode = 200>(
        data: TData,
        init?: ResponseInit & { status?: TStatus }
      ) =>
        NextResponse.json<TData>(data, init) as TypedNextResponse<
          TData,
          TStatus,
          "application/json"
        >,

      text: <TData extends string, TStatus extends HttpStatusCode = 200>(
        data: TData,
        init?: ResponseInit & { status?: TStatus }
      ) =>
        new NextResponse<TData>(data, {
          ...init,
          headers: { "Content-Type": "text/plain", ...init?.headers },
        }) as TypedNextResponse<TData, TStatus, "text/plain">,

      notFound: () => notFound() as TypedNextResponse<null, 404, "text/html">,

      redirect: <TStatus extends HttpStatusCode = 302>(
        url: string,
        status?: TStatus
      ) =>
        NextResponse.redirect(url, status) as TypedNextResponse<
          null,
          TStatus,
          "text/html"
        >,
    };

    // handlers を順番に実行し、Response が返ってきたら即終了する
    for (const handler of handlers) {
      const result = await handler(context);
      if (result instanceof Response) {
        return result as ResolvedHandlerResult;
      }
    }

    // どの handler も Response を返さなかった場合は 404
    return context.notFound() as never;
  };
};

export const createRouteHandler = <TBindings extends Bindings>() => {
  const createRoute =
    <THttpMethod extends HTTP_METHOD>(method: THttpMethod) =>
    <
      TRouteResponseType extends RouteResponseType,
      TValidateds extends Validated[],
    >(
      ...handlers: RouteHandler<TRouteResponseType, TBindings, TValidateds>[]
    ) => {
      const methodFunc = createHandler(handlers);

      return {
        [method]: methodFunc,
      } as Record<THttpMethod, typeof methodFunc>;
    };

  return {
    get: createRoute("GET"),
    post: createRoute("POST"),
    put: createRoute("PUT"),
    delete: createRoute("DELETE"),
    patch: createRoute("PATCH"),
    head: createRoute("HEAD"),
    options: createRoute("OPTIONS"),
  };
};
