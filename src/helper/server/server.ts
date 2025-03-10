import { notFound } from "next/navigation";
import { NextRequest, NextResponse } from "next/server";
import { createQueryParamsProxy } from "./createQueryParamsProxy";
import type {
  Query,
  TypedNextResponse,
  HttpStatusCode,
  ContentType,
  Context,
  Params,
} from "./types";
import type { HTTP_METHOD } from "next/dist/server/web/http";

const createHandler = <
  TParams extends Params,
  TQuery extends Query,
  THandler extends (context: Context<TParams, TQuery>) => unknown,
>(
  handler: THandler
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
    const context: Context<TParams, TQuery> = {
      req: Object.assign(req, {
        query: () => createQueryParamsProxy<TQuery>(req.nextUrl.searchParams),
        params: async () => await segmentData.params,
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

    return (await handler(context)) as ResolvedHandlerResult;
  };
};

export const createRouteHandler = <
  TBindings extends {
    params?: Params | Promise<Params>;
    query?: Query;
  },
>() => {
  type Handler<T> = (
    context: Context<TBindings["params"], TBindings["query"]>
  ) => T;
  type ResponseType = TypedNextResponse | Promise<TypedNextResponse>;

  const createMethod = <T extends ResponseType>(handler: Handler<T>) =>
    createHandler(handler);

  const createRoute =
    (method: HTTP_METHOD) =>
    <T extends ResponseType>(handler: Handler<T>) => ({
      [method]: createMethod(handler),
    });

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
