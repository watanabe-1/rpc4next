import { notFound } from "next/navigation";
import { NextResponse } from "next/server";
import { searchParamsToObject } from "./searchParamsToObject";
import type {
  Query,
  TypedNextResponse,
  HttpStatusCode,
  ContentType,
  Context,
  Params,
  ValidationTarget,
  Bindings,
  Validated,
  Handler,
} from "./types";
import type { HTTP_METHOD } from "next/dist/server/web/http";
import type { NextRequest } from "next/server";

const createHandler = <
  TParams extends Params,
  TQuery extends Query,
  TValidateds extends Validated[],
  THandlers extends Handler<TParams, TQuery, TValidateds>[],
>(
  handlers: THandlers
) => {
  type HandlerReturn = Awaited<ReturnType<THandlers[number]>>;

  return async (
    req: NextRequest,
    segmentData: { params: Promise<TParams> }
  ): Promise<HandlerReturn> => {
    const validationResults = {} as Record<ValidationTarget, unknown>;

    const context: Context<TParams, TQuery, TValidateds> = {
      req: Object.assign(req, {
        query: () => searchParamsToObject<TQuery>(req.nextUrl.searchParams),
        params: async () => await segmentData.params,
        valid: (target: ValidationTarget) => {
          return validationResults[target] as never;
        },
        addValidatedData: (target: ValidationTarget, value: object) => {
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
        return result as HandlerReturn;
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
      TValidateds extends Validated[],
      THandlers extends Handler<
        TBindings["params"],
        TBindings["query"],
        TValidateds
      >[],
    >(
      ...handlers: THandlers
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
